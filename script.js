const STORAGE_KEYS = {
    tasks: 'taskmgr-tasks',
    ideas: 'taskmgr-ideas',
    columns: 'taskmgr-columns',
    taskCounter: 'taskmgr-task-counter',
    ideaCounter: 'taskmgr-idea-counter'
};

const LEGACY_KEYS = {
    tasks: 'sara-tasks',
    ideas: 'sara-ideas',
    columns: 'sara-columns',
    taskCounter: 'sara-task-counter',
    ideaCounter: 'sara-idea-counter'
};

function migrateLegacyStorage() {
    Object.keys(STORAGE_KEYS).forEach(key => {
        const newKey = STORAGE_KEYS[key];
        const oldKey = LEGACY_KEYS[key];
        if (!oldKey) return;

        if (localStorage.getItem(newKey) === null) {
            const legacyValue = localStorage.getItem(oldKey);
            if (legacyValue !== null) {
                localStorage.setItem(newKey, legacyValue);
            }
        }

        localStorage.removeItem(oldKey);
    });
}

migrateLegacyStorage();

// Global storage
let tasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.tasks)) || {};
let ideas = JSON.parse(localStorage.getItem(STORAGE_KEYS.ideas)) || {};
let columns = JSON.parse(localStorage.getItem(STORAGE_KEYS.columns)) || {
    personal: ['on-the-table', 'in-progress', 'waiting', 'done'],
    work: ['on-the-table', 'in-progress', 'waiting', 'done']
};
let taskIdCounter = parseInt(localStorage.getItem(STORAGE_KEYS.taskCounter)) || 1;
let ideaIdCounter = parseInt(localStorage.getItem(STORAGE_KEYS.ideaCounter)) || 1;
let currentCategory = 'personal';
let selectedTasks = new Set();
let showArchived = false;
let searchQuery = '';
let priorityFilter = '';
let tagFilter = '';

// Drag and drop variables
let draggedElement = null;
let draggedOverElement = null;
let sortMode = false;
let draggedType = null;

// Column names mapping
const columnNames = {
    'on-the-table': 'On the Table',
    'in-progress': 'In Progress', 
    'waiting': 'Waiting for Review',
    'done': 'Done'
};

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    loadTheme();
    renderColumns();
    renderAllTasks();
    renderIdeas();
    updateDashboard();
    updateTagFilter();
    setupEventListeners();
});

// Theme management
function toggleTheme() {
    const body = document.body;
    const themeToggle = document.querySelector('.theme-toggle');
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    body.setAttribute('data-theme', newTheme);
    themeToggle.textContent = newTheme === 'dark' ? 'Light Mode' : 'Dark Mode';
    localStorage.setItem('theme', newTheme);
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const body = document.body;
    const themeToggle = document.querySelector('.theme-toggle');
    
    body.setAttribute('data-theme', savedTheme);
    themeToggle.textContent = savedTheme === 'dark' ? 'Light Mode' : 'Dark Mode';
}

// Column management
function renderColumns() {
    const personalBoard = document.getElementById('personal-board');
    const workBoard = document.getElementById('work-board');
    
    personalBoard.innerHTML = '';
    workBoard.innerHTML = '';
    
    columns.personal.forEach(columnId => renderColumn(personalBoard, columnId, 'personal'));
    columns.work.forEach(columnId => renderColumn(workBoard, columnId, 'work'));
}

function renderColumn(board, columnId, category) {
    const columnElement = document.createElement('div');
    columnElement.className = `column ${columnId}`;
    
    const columnName = columnNames[columnId] || columnId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    columnElement.innerHTML = `
        <div class="column-header">
            <h2 class="column-title">${columnName}</h2>
            <div class="column-actions">
                ${columnId !== 'done' ? `<button onclick="removeColumn('${columnId}', '${category}')">Remove</button>` : ''}
                <span class="task-count" data-column="${columnId}" data-category="${category}">0</span>
            </div>
        </div>
        <div class="drop-zone" data-column="${columnId}" data-category="${category}"></div>
    `;
    
    board.appendChild(columnElement);
}

function addCustomColumn() {
    const columnName = prompt('Enter column name:');
    if (!columnName) return;
    
    const columnId = columnName.toLowerCase().replace(/\s+/g, '-');
    const insertIndex = columns[currentCategory].length - 1; // Insert before 'done'
    
    columns[currentCategory].splice(insertIndex, 0, columnId);
    columnNames[columnId] = columnName;
    
    saveToStorage();
    renderColumns();
    renderAllTasks();
}

function removeColumn(columnId, category) {
    if (columnId === 'done') return; // Can't remove done column
    
    const tasksInColumn = Object.values(tasks).filter(t => t.column === columnId && t.category === category);
    if (tasksInColumn.length > 0) {
        const moveTo = prompt('Column has tasks. Move them to which column?', 'on-the-table');
        if (moveTo && columns[category].includes(moveTo)) {
            tasksInColumn.forEach(task => {
                task.column = moveTo;
                task.updatedAt = new Date().toISOString();
            });
        }
    }
    
    columns[category] = columns[category].filter(col => col !== columnId);
    saveToStorage();
    renderColumns();
    renderAllTasks();
}

// Category switching
function switchCategory(category) {
    if (currentCategory === category) return;
    
    currentCategory = category;
    
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    const currentBoard = document.querySelector('.board.active');
    if (currentBoard) {
        currentBoard.classList.remove('active');
    }
    
    setTimeout(() => {
        document.getElementById(`${category}-board`).classList.add('active');
        renderIdeas();
        updateDashboard();
        updateTagFilter();
    }, 200);
}

// Task management
function addIdea() {
    const input = document.getElementById('idea-input');
    const content = input.value.trim();
    
    if (!content) return;
    
    const ideaId = `idea-${ideaIdCounter++}`;
    const idea = {
        id: ideaId,
        content: content,
        category: currentCategory,
        createdAt: new Date().toISOString()
    };
    
    ideas[ideaId] = idea;
    input.value = '';
    
    saveToStorage();
    renderIdeas();
}

function addSubtask(taskId, subtaskInput) {
    const content = subtaskInput.value.trim();
    if (!content) return;
    
    const subtask = {
        id: `subtask-${Date.now()}`,
        content: content,
        completed: false
    };
    
    if (!tasks[taskId].subtasks) tasks[taskId].subtasks = [];
    tasks[taskId].subtasks.push(subtask);
    tasks[taskId].updatedAt = new Date().toISOString();
    subtaskInput.value = '';
    
    saveToStorage();
    renderAllTasks();
    updateDashboard();
}

function toggleSubtask(taskId, subtaskId) {
    const task = tasks[taskId];
    const subtask = task.subtasks.find(st => st.id === subtaskId);
    if (subtask) {
        subtask.completed = !subtask.completed;
        task.updatedAt = new Date().toISOString();
        saveToStorage();
        renderAllTasks();
        updateDashboard();
    }
}

function deleteSubtask(taskId, subtaskId) {
    const task = tasks[taskId];
    task.subtasks = task.subtasks.filter(st => st.id !== subtaskId);
    task.updatedAt = new Date().toISOString();
    saveToStorage();
    renderAllTasks();
}

function addComment(taskId, commentInput) {
    const content = commentInput.value.trim();
    if (!content) return;
    
    const comment = {
        id: `comment-${Date.now()}`,
        content: content,
        createdAt: new Date().toISOString()
    };
    
    if (!tasks[taskId].comments) tasks[taskId].comments = [];
    tasks[taskId].comments.push(comment);
    tasks[taskId].updatedAt = new Date().toISOString();
    commentInput.value = '';
    
    saveToStorage();
    renderAllTasks();
}

function deleteComment(taskId, commentId) {
    const task = tasks[taskId];
    if (task.comments) {
        task.comments = task.comments.filter(c => c.id !== commentId);
        task.updatedAt = new Date().toISOString();
        saveToStorage();
        renderAllTasks();
    }
}

function addTag(taskId, tagInput) {
    const content = tagInput.value.trim();
    if (!content) return;
    
    if (!tasks[taskId].tags) tasks[taskId].tags = [];
    if (!tasks[taskId].tags.includes(content)) {
        tasks[taskId].tags.push(content);
        tasks[taskId].updatedAt = new Date().toISOString();
        tagInput.value = '';
        saveToStorage();
        renderAllTasks();
        updateTagFilter();
    }
}

function removeTag(taskId, tag) {
    if (!tasks[taskId].tags) return;
    tasks[taskId].tags = tasks[taskId].tags.filter(t => t !== tag);
    tasks[taskId].updatedAt = new Date().toISOString();
    saveToStorage();
    renderAllTasks();
    updateTagFilter();
}

function addDependency(taskId) {
    const availableTasks = Object.values(tasks)
        .filter(t => t.id !== taskId && t.category === tasks[taskId].category && !t.archived)
        .map(t => `${t.id}: ${t.content.substring(0, 50)}`)
        .join('\n');
    
    if (!availableTasks) {
        alert('No other tasks available for dependencies in this category.');
        return;
    }
    
    const dependencyId = prompt(`Select task dependency:\n${availableTasks}\n\nEnter task ID:`);
    if (dependencyId && tasks[dependencyId]) {
        if (!tasks[taskId].dependencies) tasks[taskId].dependencies = [];
        if (!tasks[taskId].dependencies.includes(dependencyId)) {
            tasks[taskId].dependencies.push(dependencyId);
            tasks[taskId].updatedAt = new Date().toISOString();
            saveToStorage();
            renderAllTasks();
        }
    }
}

function deleteDependency(taskId, dependencyId) {
    if (!tasks[taskId].dependencies) return;
    tasks[taskId].dependencies = tasks[taskId].dependencies.filter(d => d !== dependencyId);
    tasks[taskId].updatedAt = new Date().toISOString();
    saveToStorage();
    renderAllTasks();
}

function deleteIdea(ideaId) {
    delete ideas[ideaId];
    saveToStorage();
    renderIdeas();
}

function setPriority(taskId, priority) {
    tasks[taskId].priority = priority;
    tasks[taskId].updatedAt = new Date().toISOString();
    saveToStorage();
    renderAllTasks();
}

function getNextOrderInColumn(column, category) {
    const columnTasks = Object.values(tasks).filter(t => 
        t.column === column && t.category === category && !t.archived
    );
    return columnTasks.length > 0 ? Math.max(...columnTasks.map(t => t.order || 0)) + 1 : 0;
}

function calculateTimeInColumn(task) {
    if (!task.columnHistory || task.columnHistory.length === 0) return '0d';
    const now = new Date();
    const lastMove = new Date(task.columnHistory[task.columnHistory.length - 1]?.timestamp || task.createdAt);
    const days = Math.ceil((now - lastMove) / (1000 * 60 * 60 * 24));
    return `${days}d`;
}

function filterTasks() {
    searchQuery = document.getElementById('search-input').value.toLowerCase();
    priorityFilter = document.getElementById('priority-filter').value;
    tagFilter = document.getElementById('tag-filter').value;
    renderAllTasks();
}

function taskMatchesFilters(task) {
    if (!!task.archived !== showArchived) return false;
    
    if (searchQuery && !task.content.toLowerCase().includes(searchQuery)) {
        const hasMatchingSubtask = task.subtasks?.some(st => 
            st.content.toLowerCase().includes(searchQuery)
        );
        const hasMatchingComment = task.comments?.some(c => 
            c.content.toLowerCase().includes(searchQuery)
        );
        if (!hasMatchingSubtask && !hasMatchingComment) return false;
    }
    
    if (priorityFilter && task.priority !== priorityFilter) return false;
    if (tagFilter && (!task.tags || !task.tags.includes(tagFilter))) return false;
    
    return true;
}

function renderAllTasks() {
    document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.innerHTML = '';
    });
    
    const tasksByCategory = {};
    Object.values(tasks).forEach(task => {
        if (!taskMatchesFilters(task)) return;
        
        if (!tasksByCategory[task.category]) {
            tasksByCategory[task.category] = {};
        }
        if (!tasksByCategory[task.category][task.column]) {
            tasksByCategory[task.category][task.column] = [];
        }
        tasksByCategory[task.category][task.column].push(task);
    });
    
    Object.keys(tasksByCategory).forEach(category => {
        Object.keys(tasksByCategory[category]).forEach(column => {
            tasksByCategory[category][column].sort((a, b) => (a.order || 0) - (b.order || 0));
        });
    });
    
    Object.keys(tasksByCategory).forEach(category => {
        Object.keys(tasksByCategory[category]).forEach(column => {
            tasksByCategory[category][column].forEach(task => {
                renderTask(task);
            });
        });
    });
    
    updateTaskCounts();
}

function renderTask(task) {
    const taskElement = document.createElement('div');
    taskElement.className = `task priority-${task.priority || 'medium'}`;
    if (selectedTasks.has(task.id)) taskElement.classList.add('selected');
    taskElement.draggable = true;
    taskElement.dataset.taskId = task.id;
    taskElement.dataset.category = task.category;
    taskElement.dataset.column = task.column;
    
    const createdDate = new Date(task.createdAt).toLocaleDateString();
    const timeInColumn = calculateTimeInColumn(task);
    
    let dependenciesHtml = '';
    if (task.dependencies && task.dependencies.length > 0) {
        dependenciesHtml = `<div class="dependencies">
            <strong>Dependencies:</strong>
            ${task.dependencies.map(depId => {
                const depTask = tasks[depId];
                if (!depTask) return '';
                const isBlocked = depTask.column !== 'done';
                return `<div class="dependency-item ${isBlocked ? 'blocked' : 'completed'}">
                    ${depTask.content.substring(0, 30)}... ${isBlocked ? '(Blocking)' : '(Done)'}
                    <button onclick="deleteDependency('${task.id}', '${depId}')">×</button>
                </div>`;
            }).join('')}
            <button onclick="addDependency('${task.id}')">+ Add Dependency</button>
        </div>`;
    } else {
        dependenciesHtml = `<button onclick="addDependency('${task.id}')" style="font-size: 11px; padding: 4px 8px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-secondary); cursor: pointer;">+ Add Dependency</button>`;
    }
    
    let tagsHtml = '';
    if (task.tags && task.tags.length > 0) {
        tagsHtml = `<div class="task-tags">
            ${task.tags.map(tag => `<span class="tag" onclick="removeTag('${task.id}', '${tag}')" title="Click to remove">${tag} ×</span>`).join('')}
        </div>`;
    }
    tagsHtml += `<div class="add-tag-form">
        <input type="text" class="add-tag-input" placeholder="Add tag..." onkeypress="if(event.key==='Enter') addTag('${task.id}', this)">
    </div>`;
    
    let subtasksHtml = '';
    if (task.subtasks && task.subtasks.length > 0) {
        subtasksHtml = `<div class="subtasks">`;
        task.subtasks.forEach(subtask => {
            subtasksHtml += `
                <div class="subtask">
                    <div class="subtask-checkbox ${subtask.completed ? 'completed' : ''}" 
                         onclick="toggleSubtask('${task.id}', '${subtask.id}')"></div>
                    <span class="subtask-text ${subtask.completed ? 'completed' : ''}">${escapeHtml(subtask.content)}</span>
                    <button class="subtask-delete" onclick="deleteSubtask('${task.id}', '${subtask.id}')" title="Delete">×</button>
                </div>
            `;
        });
        subtasksHtml += `
            <div class="add-subtask">
                <input type="text" placeholder="Add subtask..." onkeypress="if(event.key==='Enter') addSubtask('${task.id}', this)">
                <button onclick="addSubtask('${task.id}', this.previousElementSibling)">Add</button>
            </div>
        </div>`;
    } else {
        subtasksHtml = `
            <div class="subtasks">
                <div class="add-subtask">
                    <input type="text" placeholder="Add subtask..." onkeypress="if(event.key==='Enter') addSubtask('${task.id}', this)">
                    <button onclick="addSubtask('${task.id}', this.previousElementSibling)">Add</button>
                </div>
            </div>
        `;
    }
    
    let commentsHtml = '';
    if (task.comments && task.comments.length > 0) {
        commentsHtml = `<div class="comments">`;
        task.comments.forEach(comment => {
            const commentDate = new Date(comment.createdAt).toLocaleDateString();
            commentsHtml += `
                <div class="comment">
                    <div class="comment-meta">${commentDate}</div>
                    <div>${escapeHtml(comment.content)}</div>
                    <button class="comment-delete" onclick="deleteComment('${task.id}', '${comment.id}')" title="Delete">×</button>
                </div>
            `;
        });
        commentsHtml += `
            <div class="add-comment">
                <input type="text" placeholder="Add comment..." onkeypress="if(event.key==='Enter') addComment('${task.id}', this)">
                <button onclick="addComment('${task.id}', this.previousElementSibling)">Add</button>
            </div>
        </div>`;
    } else {
        commentsHtml = `
            <div class="comments">
                <div class="add-comment">
                    <input type="text" placeholder="Add comment..." onkeypress="if(event.key==='Enter') addComment('${task.id}', this)">
                    <button onclick="addComment('${task.id}', this.previousElementSibling)">Add</button>
                </div>
            </div>
        `;
    }

    const prioritySelector = `
        <div class="priority-selector">
            <div class="priority-btn urgent ${task.priority === 'urgent' ? 'active' : ''}" onclick="setPriority('${task.id}', 'urgent')" title="Urgent"></div>
            <div class="priority-btn high ${task.priority === 'high' ? 'active' : ''}" onclick="setPriority('${task.id}', 'high')" title="High"></div>
            <div class="priority-btn medium ${task.priority === 'medium' ? 'active' : ''}" onclick="setPriority('${task.id}', 'medium')" title="Medium"></div>
            <div class="priority-btn low ${task.priority === 'low' ? 'active' : ''}" onclick="setPriority('${task.id}', 'low')" title="Low"></div>
        </div>
    `;
    
    taskElement.innerHTML = `
        <div class="sort-indicator"></div>
        <input type="checkbox" class="task-select" onchange="toggleTaskSelection('${task.id}')">
        <div class="task-header">
            <div class="task-content">${escapeHtml(task.content)}</div>
            <div class="task-main-actions">
                <button onclick="editTask('${task.id}')" title="Edit">✎</button>
                <button onclick="archiveTask('${task.id}')" title="${task.archived ? 'Unarchive' : 'Archive'}">${task.archived ? '📤' : '📦'}</button>
                <button onclick="deleteTask('${task.id}')" title="Delete">×</button>
            </div>
        </div>
        ${dependenciesHtml}
        ${prioritySelector}
        ${tagsHtml}
        ${subtasksHtml}
        ${commentsHtml}
        <div class="task-meta">
            <span>Created: ${createdDate}</span>
            <div class="time-tracker">Time in column: ${timeInColumn}</div>
        </div>
    `;
    
    const dropZone = document.querySelector(`[data-column="${task.column}"][data-category="${task.category}"].drop-zone`);
    if (dropZone) {
        dropZone.appendChild(taskElement);
    }
}

function renderIdeas() {
    const ideasList = document.getElementById('ideas-list');
    const ideasCount = document.getElementById('ideas-count');
    
    ideasList.innerHTML = '';
    
    const categoryIdeas = Object.values(ideas).filter(idea => idea.category === currentCategory);
    ideasCount.textContent = categoryIdeas.length;
    
    categoryIdeas.forEach(idea => {
        const ideaElement = document.createElement('div');
        ideaElement.className = 'idea-item';
        ideaElement.draggable = true;
        ideaElement.dataset.ideaId = idea.id;
        ideaElement.innerHTML = `
            <span class="idea-text">${escapeHtml(idea.content)}</span>
            <button class="idea-delete" onclick="deleteIdea('${idea.id}')" title="Delete">×</button>
        `;
        ideasList.appendChild(ideaElement);
    });
}

function editTask(taskId) {
    const task = tasks[taskId];
    if (!task) return;
    
    const newContent = prompt('Edit task:', task.content);
    if (newContent && newContent.trim()) {
        task.content = newContent.trim();
        task.updatedAt = new Date().toISOString();
        saveToStorage();
        renderAllTasks();
    }
}

function deleteTask(taskId) {
    if (confirm('Are you sure you want to delete this task?')) {
        delete tasks[taskId];
        selectedTasks.delete(taskId);
        saveToStorage();
        renderAllTasks();
        updateDashboard();
    }
}

function archiveTask(taskId) {
    tasks[taskId].archived = !tasks[taskId].archived;
    tasks[taskId].updatedAt = new Date().toISOString();
    saveToStorage();
    renderAllTasks();
    updateDashboard();
}

function toggleArchived() {
    showArchived = !showArchived;
    const button = event.target;
    button.textContent = showArchived ? 'Show Active' : 'Show Archived';
    renderAllTasks();
}

function toggleTaskSelection(taskId) {
    if (selectedTasks.has(taskId)) {
        selectedTasks.delete(taskId);
    } else {
        selectedTasks.add(taskId);
    }
    
    const bulkActions = document.getElementById('bulk-actions');
    if (selectedTasks.size > 0) {
        bulkActions.classList.add('visible');
    } else {
        bulkActions.classList.remove('visible');
    }
    
    renderAllTasks();
}

function clearSelection() {
    selectedTasks.clear();
    document.getElementById('bulk-actions').classList.remove('visible');
    renderAllTasks();
}

function bulkDelete() {
    if (confirm(`Delete ${selectedTasks.size} selected tasks?`)) {
        selectedTasks.forEach(taskId => delete tasks[taskId]);
        selectedTasks.clear();
        document.getElementById('bulk-actions').classList.remove('visible');
        saveToStorage();
        renderAllTasks();
        updateDashboard();
    }
}

function bulkMove(column) {
    selectedTasks.forEach(taskId => {
        if (tasks[taskId]) {
            const oldColumn = tasks[taskId].column;
            tasks[taskId].column = column;
            tasks[taskId].updatedAt = new Date().toISOString();
            if (oldColumn !== column) {
                trackColumnChange(tasks[taskId], column);
            }
        }
    });
    selectedTasks.clear();
    document.getElementById('bulk-actions').classList.remove('visible');
    saveToStorage();
    renderAllTasks();
    updateDashboard();
}

function bulkSetPriority(priority) {
    selectedTasks.forEach(taskId => {
        if (tasks[taskId]) {
            tasks[taskId].priority = priority;
            tasks[taskId].updatedAt = new Date().toISOString();
        }
    });
    selectedTasks.clear();
    document.getElementById('bulk-actions').classList.remove('visible');
    saveToStorage();
    renderAllTasks();
}

function bulkArchive() {
    selectedTasks.forEach(taskId => {
        if (tasks[taskId]) {
            tasks[taskId].archived = true;
            tasks[taskId].updatedAt = new Date().toISOString();
        }
    });
    selectedTasks.clear();
    document.getElementById('bulk-actions').classList.remove('visible');
    saveToStorage();
    renderAllTasks();
    updateDashboard();
}

function updateTaskCounts() {
    const counts = {};
    
    Object.values(tasks).forEach(task => {
        if (!taskMatchesFilters(task)) return;
        const key = `${task.category}-${task.column}`;
        counts[key] = (counts[key] || 0) + 1;
    });
    
    document.querySelectorAll('.task-count').forEach(countElement => {
        const column = countElement.dataset.column;
        const category = countElement.dataset.category;
        const key = `${category}-${column}`;
        countElement.textContent = counts[key] || 0;
    });
}

function updateTagFilter() {
    const tagFilter = document.getElementById('tag-filter');
    const allTags = new Set();
    
    Object.values(tasks).forEach(task => {
        if (task.tags && task.category === currentCategory) {
            task.tags.forEach(tag => allTags.add(tag));
        }
    });
    
    const currentValue = tagFilter.value;
    tagFilter.innerHTML = '<option value="">All Tags</option>';
    
    Array.from(allTags).sort().forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        if (tag === currentValue) option.selected = true;
        tagFilter.appendChild(option);
    });
}

function updateDashboard() {
    const categoryTasks = Object.values(tasks).filter(t => 
        t.category === currentCategory && !t.archived
    );
    
    const totalTasks = categoryTasks.length;
    const completedTasks = categoryTasks.filter(t => t.column === 'done').length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    // Calculate average completion time
    const completedWithTime = categoryTasks.filter(t => 
        t.column === 'done' && t.columnHistory
    );
    
    let avgTime = 0;
    if (completedWithTime.length > 0) {
        const totalDays = completedWithTime.reduce((sum, task) => {
            const created = new Date(task.createdAt);
            const completed = new Date(task.updatedAt);
            const days = Math.ceil((completed - created) / (1000 * 60 * 60 * 24));
            return sum + days;
        }, 0);
        avgTime = Math.round(totalDays / completedWithTime.length);
    }
    
    document.getElementById('total-tasks').textContent = totalTasks;
    document.getElementById('completed-tasks').textContent = completedTasks;
    document.getElementById('completion-rate').textContent = `${completionRate}%`;
    document.getElementById('avg-time').textContent = `${avgTime}d`;
    document.getElementById('progress-fill').style.width = `${completionRate}%`;
}

function trackColumnChange(task, newColumn) {
    if (!task.columnHistory) task.columnHistory = [];
    task.columnHistory.push({
        column: newColumn,
        timestamp: new Date().toISOString()
    });
}

function setupEventListeners() {
    document.getElementById('idea-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addIdea();
        }
    });

    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);
    document.addEventListener('dragend', handleDragEnd);
}

// Drag and drop handlers
function handleDragStart(e) {
    if (e.target.classList.contains('task')) {
        draggedElement = e.target;
        draggedType = 'task';
        e.target.classList.add('dragging');
        
        const column = e.target.dataset.column;
        const category = e.target.dataset.category;
        const columnTasks = document.querySelectorAll(`[data-column="${column}"][data-category="${category}"].task`);
        sortMode = columnTasks.length > 1;
    } else if (e.target.classList.contains('idea-item')) {
        draggedElement = e.target;
        draggedType = 'idea';
        e.target.classList.add('dragging');
        sortMode = false;
    }
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDragEnter(e) {
    const dropZone = e.target.closest('.drop-zone');
    const task = e.target.closest('.task');
    
    if (dropZone) {
        dropZone.classList.add('drag-over');
    }
    
    if (task && sortMode && task !== draggedElement && draggedType === 'task') {
        const draggedColumn = draggedElement.dataset.column;
        const draggedCategory = draggedElement.dataset.category;
        const targetColumn = task.dataset.column;
        const targetCategory = task.dataset.category;
        
        if (draggedColumn === targetColumn && draggedCategory === targetCategory) {
            document.querySelectorAll('.sort-target').forEach(el => {
                el.classList.remove('sort-target');
            });
            
            task.classList.add('sort-target');
            draggedOverElement = task;
        }
    }
}

function handleDragLeave(e) {
    const dropZone = e.target.closest('.drop-zone');
    if (dropZone && !dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove('drag-over');
    }
    
    const task = e.target.closest('.task');
    if (task) {
        task.classList.remove('sort-target');
    }
}

function handleDrop(e) {
    e.preventDefault();
    
    if (!draggedElement) return;
    
    const dropZone = e.target.closest('.drop-zone');
    const targetTask = e.target.closest('.task');
    
    if (dropZone) {
        if (draggedType === 'task') {
            const taskId = draggedElement.dataset.taskId;
            const newColumn = dropZone.dataset.column;
            const newCategory = dropZone.dataset.category;
            
            if (tasks[taskId]) {
                if (targetTask && sortMode && 
                    draggedElement.dataset.column === newColumn && 
                    draggedElement.dataset.category === newCategory) {
                    
                    reorderTasks(taskId, targetTask.dataset.taskId, newColumn, newCategory);
                } else {
                    const oldColumn = tasks[taskId].column;
                    tasks[taskId].column = newColumn;
                    tasks[taskId].category = newCategory;
                    tasks[taskId].order = getNextOrderInColumn(newColumn, newCategory);
                    tasks[taskId].updatedAt = new Date().toISOString();
                    
                    if (oldColumn !== newColumn) {
                        trackColumnChange(tasks[taskId], newColumn);
                    }
                }
                
                saveToStorage();
                renderAllTasks();
                updateDashboard();
            }
        } else if (draggedType === 'idea') {
            const ideaId = draggedElement.dataset.ideaId;
            const idea = ideas[ideaId];
            const newColumn = dropZone.dataset.column;
            const newCategory = dropZone.dataset.category;
            
            if (idea) {
                const taskId = `task-${taskIdCounter++}`;
                const task = {
                    id: taskId,
                    content: idea.content,
                    column: newColumn,
                    category: newCategory,
                    priority: 'medium',
                    order: getNextOrderInColumn(newColumn, newCategory),
                    subtasks: [],
                    comments: [],
                    tags: [],
                    dependencies: [],
                    columnHistory: [],
                    archived: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                trackColumnChange(task, newColumn);
                tasks[taskId] = task;
                delete ideas[ideaId];
                
                saveToStorage();
                renderAllTasks();
                renderIdeas();
                updateDashboard();
            }
        }
    }
    
    document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.classList.remove('drag-over');
    });
    document.querySelectorAll('.sort-target').forEach(el => {
        el.classList.remove('sort-target');
    });
}

function handleDragEnd(e) {
    if (e.target.classList.contains('task') || e.target.classList.contains('idea-item')) {
        e.target.classList.remove('dragging');
    }
    
    document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.classList.remove('drag-over');
    });
    document.querySelectorAll('.sort-target').forEach(el => {
        el.classList.remove('sort-target');
    });
    
    draggedElement = null;
    draggedOverElement = null;
    draggedType = null;
    sortMode = false;
}

function reorderTasks(draggedTaskId, targetTaskId, column, category) {
    const columnTasks = Object.values(tasks)
        .filter(t => t.column === column && t.category === category && taskMatchesFilters(t))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const draggedTask = tasks[draggedTaskId];
    const targetIndex = columnTasks.findIndex(t => t.id === targetTaskId);
    
    const filteredTasks = columnTasks.filter(t => t.id !== draggedTaskId);
    filteredTasks.splice(targetIndex, 0, draggedTask);
    
    filteredTasks.forEach((task, index) => {
        tasks[task.id].order = index;
        tasks[task.id].updatedAt = new Date().toISOString();
    });
    
    saveToStorage();
}

function saveToStorage() {
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
    localStorage.setItem(STORAGE_KEYS.ideas, JSON.stringify(ideas));
    localStorage.setItem(STORAGE_KEYS.columns, JSON.stringify(columns));
    localStorage.setItem(STORAGE_KEYS.taskCounter, taskIdCounter.toString());
    localStorage.setItem(STORAGE_KEYS.ideaCounter, ideaIdCounter.toString());
}

function exportTasks() {
    const dataStr = JSON.stringify({
        tasks: tasks,
        ideas: ideas,
        columns: columns,
        taskIdCounter: taskIdCounter,
        ideaIdCounter: ideaIdCounter,
        exportDate: new Date().toISOString(),
        currentCategory: currentCategory
    }, null, 2);
    
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${STORAGE_KEYS.tasks}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function importTasks(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.tasks) {
                if (confirm('This will replace all current data. Are you sure?')) {
                    tasks = data.tasks;
                    ideas = data.ideas || {};
                    columns = data.columns || {
                        personal: ['on-the-table', 'in-progress', 'waiting', 'done'],
                        work: ['on-the-table', 'in-progress', 'waiting', 'done']
                    };
                    taskIdCounter = data.taskIdCounter || Object.keys(tasks).length + 1;
                    ideaIdCounter = data.ideaIdCounter || Object.keys(ideas).length + 1;
                    
                    if (data.currentCategory) {
                        switchCategoryProgrammatically(data.currentCategory);
                    }
                    
                    saveToStorage();
                    renderColumns();
                    renderAllTasks();
                    renderIdeas();
                    updateDashboard();
                    updateTagFilter();
                    alert('Data imported successfully!');
                }
            }
        } catch (error) {
            alert('Error importing data. Please check the file format.');
        }
    };
    reader.readAsText(file);
    
    event.target.value = '';
}

function switchCategoryProgrammatically(category) {
    if (currentCategory === category) return;
    
    currentCategory = category;
    
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase() === category) {
            btn.classList.add('active');
        }
    });
    
    const currentBoard = document.querySelector('.board.active');
    if (currentBoard) {
        currentBoard.classList.remove('active');
    }
    
    setTimeout(() => {
        document.getElementById(`${category}-board`).classList.add('active');
        renderIdeas();
        updateDashboard();
        updateTagFilter();
    }, 200);
}

function clearAllTasks() {
    if (confirm('Are you sure you want to delete all tasks and ideas? This cannot be undone.')) {
        tasks = {};
        ideas = {};
        taskIdCounter = 1;
        ideaIdCounter = 1;
        selectedTasks.clear();
        document.getElementById('bulk-actions').classList.remove('visible');
        saveToStorage();
        renderColumns();
        renderAllTasks();
        renderIdeas();
        updateDashboard();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

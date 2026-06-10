document.addEventListener("DOMContentLoaded", () => {
    // API URL configuration
    const API = window.location.origin;

    // DOM Elements - Auth
    const loginOverlay = document.getElementById("loginOverlay");
    const loginForm = document.getElementById("loginForm");
    const loginUser = document.getElementById("loginUser");
    const loginPass = document.getElementById("loginPass");
    const btnTogglePass = document.getElementById("btnTogglePass");
    const loginErrorMsg = document.getElementById("loginErrorMsg");
    const btnLogout = document.getElementById("btnLogout");

    // DOM Elements - Navigation
    const mainDashboard = document.getElementById("mainDashboard");
    const tabChartBtn = document.getElementById("tabChartBtn");
    const tabAdminBtn = document.getElementById("tabAdminBtn");
    const panelChart = document.getElementById("panelChart");
    const panelAdmin = document.getElementById("panelAdmin");
    const userNameEl = document.getElementById("userName");
    const userRoleEl = document.getElementById("userRole");
    const userAvatarEl = document.getElementById("userAvatar");

    // DOM Elements - Chart
    const symbolInput = document.getElementById("symbolInput");
    const exchangeSelect = document.getElementById("exchangeSelect");
    const btnLoadChart = document.getElementById("btnLoadChart");
    const btnOpenExternal = document.getElementById("btnOpenExternal");

    // DOM Elements - Admin Panel
    const btnShowAddUser = document.getElementById("btnShowAddUser");
    const btnCancelAddUser = document.getElementById("btnCancelAddUser");
    const addUserBox = document.getElementById("addUserBox");
    const addUserForm = document.getElementById("addUserForm");
    const newUserName = document.getElementById("newUserName");
    const newUserId = document.getElementById("newUserId");
    const newUserPass = document.getElementById("newUserPass");
    const usersTableBody = document.getElementById("usersTableBody");
    const adminAlert = document.getElementById("adminAlert");

    // Global session state
    let currentUser = null;
    let currentToken = localStorage.getItem("shama_chart_token");

    // ==========================================================
    // AUTHENTICATION MANAGEMENT
    // ==========================================================

    // Toggle Password eye button
    btnTogglePass.addEventListener("click", () => {
        const type = loginPass.getAttribute("type") === "password" ? "text" : "password";
        loginPass.setAttribute("type", type);
        btnTogglePass.innerHTML = type === "password" ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
    });

    // Verify token validity
    const checkSession = async () => {
        if (!currentToken) {
            showLoginOverlay();
            return;
        }

        try {
            const res = await fetch(`${API}/api/verify`, {
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });
            const data = await res.json();
            if (data.success) {
                currentUser = data.user;
                unlockDashboard();
            } else {
                logout();
            }
        } catch (err) {
            console.warn("Backend connection issues, utilizing offline token verification.", err);
            // Safe offline fallback
            try {
                const payload = JSON.parse(atob(currentToken.split('.')[1]));
                currentUser = payload;
                unlockDashboard();
            } catch {
                logout();
            }
        }
    };

    // Unlock dashboard
    const unlockDashboard = () => {
        loginOverlay.style.opacity = "0";
        loginOverlay.style.pointerEvents = "none";
        document.body.style.overflow = "auto";
        setTimeout(() => {
            loginOverlay.style.display = "none";
        }, 500);

        // Update User info
        userNameEl.textContent = currentUser.name || currentUser.username;
        userRoleEl.textContent = currentUser.role;
        userAvatarEl.textContent = (currentUser.name || currentUser.username).charAt(0).toUpperCase();

        if (currentUser.role === "ADMIN") {
            tabAdminBtn.style.display = "flex";
            userRoleEl.style.background = "rgba(251, 191, 36, 0.15)";
            userRoleEl.style.color = "#fbbf24";
            userRoleEl.style.border = "1px solid rgba(251, 191, 36, 0.3)";
        } else {
            tabAdminBtn.style.display = "none";
            userRoleEl.style.background = "rgba(59, 130, 246, 0.15)";
            userRoleEl.style.color = "#93c5fd";
            userRoleEl.style.border = "1px solid rgba(59, 130, 246, 0.3)";
        }

        mainDashboard.style.display = "grid";
        loadTradingViewWidget();
    };

    const showLoginOverlay = () => {
        mainDashboard.style.display = "none";
        loginOverlay.style.display = "flex";
        loginOverlay.style.opacity = "1";
        loginOverlay.style.pointerEvents = "all";
        document.body.style.overflow = "hidden";
    };

    // Form Login Submit handler
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        loginErrorMsg.style.display = "none";

        const username = loginUser.value.trim();
        const password = loginPass.value;

        try {
            const res = await fetch(`${API}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (data.success && data.token) {
                localStorage.setItem("shama_chart_token", data.token);
                currentToken = data.token;
                currentUser = data.user;
                unlockDashboard();
            } else {
                showLoginError(data.message || "Invalid credentials!");
            }
        } catch (err) {
            console.error(err);
            showLoginError("Local server connection offline. Ensure START_PORTAL.bat is active!");
        }
    });

    const showLoginError = (msg) => {
        loginErrorMsg.querySelector("span").textContent = msg;
        loginErrorMsg.style.display = "flex";
        const loginBox = document.querySelector(".login-box");
        loginBox.classList.add("shake-animation");
        setTimeout(() => loginBox.classList.remove("shake-animation"), 500);
    };

    // Logout function
    const logout = () => {
        localStorage.removeItem("shama_chart_token");
        currentToken = null;
        currentUser = null;
        loginUser.value = "";
        loginPass.value = "";
        loginErrorMsg.style.display = "none";
        showLoginOverlay();
    };

    btnLogout.addEventListener("click", () => {
        if (confirm("Are you sure you want to sign out from the premium portal?")) {
            logout();
        }
    });

    // ==========================================================
    // TAB MANAGEMENT & ROUTING
    // ==========================================================
    tabChartBtn.addEventListener("click", () => {
        tabChartBtn.classList.add("active");
        tabAdminBtn.classList.remove("active");
        panelChart.style.display = "flex";
        panelAdmin.style.display = "none";
        loadTradingViewWidget(); // Force reload to fit wrapper
    });

    tabAdminBtn.addEventListener("click", () => {
        tabAdminBtn.classList.add("active");
        tabChartBtn.classList.remove("active");
        panelAdmin.style.display = "block";
        panelChart.style.display = "none";
        fetchAdminUsers();
    });

    // ==========================================================
    // TRADINGVIEW INTEGRATION SERVICE
    // ==========================================================
    const getSymbolFormatted = () => {
        const symbol = symbolInput.value.toUpperCase().trim() || "AFCONS";
        const exchange = exchangeSelect.value;
        return `${exchange}:${symbol}`;
    };

    const loadTradingViewWidget = () => {
        const tvSymbol = getSymbolFormatted();
        const container = document.getElementById("tradingviewWidget");
        if (!container) return;

        container.innerHTML = ""; // Clear existing

        const uniqueId = `tv_widget_embed_${Date.now()}`;
        const div = document.createElement("div");
        div.id = uniqueId;
        div.style.width = "100%";
        div.style.height = "100%";
        container.appendChild(div);

        if (typeof TradingView !== "undefined" && TradingView.widget) {
            try {
                new TradingView.widget({
                    "width": "100%",
                    "height": "100%",
                    "symbol": tvSymbol,
                    "interval": "5",
                    "timezone": "Asia/Kolkata",
                    "theme": "dark",
                    "style": "1",
                    "locale": "en",
                    "enable_publishing": false,
                    "hide_side_toolbar": false,
                    "allow_symbol_change": true,
                    "container_id": uniqueId
                });
                console.log(`[+] Live widget injected: ${tvSymbol}`);
            } catch (e) {
                loadIframeFallback(div, tvSymbol);
            }
        } else {
            loadIframeFallback(div, tvSymbol);
        }
    };

    const loadIframeFallback = (container, symbol) => {
        if (!container) return;
        container.innerHTML = `
            <iframe 
                src="https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(symbol)}&interval=5&theme=dark&style=1&timezone=Asia%2FKolkata&locale=en" 
                style="width: 100%; height: 100%; border: none; border-radius: 6px;" 
                allowtransparency="true" 
                scrolling="no" 
                allowfullscreen>
            </iframe>
        `;
    };

    // Load Chart Actions
    btnLoadChart.addEventListener("click", loadTradingViewWidget);
    symbolInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") loadTradingViewWidget();
    });

    // Premium Open Chart in New Tab Action (Bypasses framing and includes the user's customized layout)
    btnOpenExternal.addEventListener("click", () => {
        const symbol = symbolInput.value.toUpperCase().trim() || "AFCONS";
        const exchange = exchangeSelect.value;
        const fullSymbol = `${exchange}:${symbol}`;
        
        // This links directly to the user's custom layout layout SroZAiWY
        const customLayoutUrl = `https://in.tradingview.com/chart/SroZAiWY/?symbol=${encodeURIComponent(fullSymbol)}`;
        window.open(customLayoutUrl, "_blank");
    });

    // ==========================================================
    // ADMIN PANEL ACTIONS (CRUD)
    // ==========================================================
    const showAdminAlert = (text, type = "success") => {
        adminAlert.textContent = text;
        adminAlert.className = `admin-alert ${type}`;
        adminAlert.style.display = "block";
        setTimeout(() => {
            adminAlert.style.display = "none";
        }, 4000);
    };

    // Form user toggle collapsible
    btnShowAddUser.addEventListener("click", () => {
        addUserBox.style.display = addUserBox.style.display === "none" ? "block" : "none";
    });
    btnCancelAddUser.addEventListener("click", () => {
        addUserBox.style.display = "none";
    });

    // Fetch users list
    const fetchAdminUsers = async () => {
        try {
            const res = await fetch(`${API}/api/admin/users`, {
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) {
                renderUsersTable(data);
            }
        } catch {
            showAdminAlert("Failed to fetch allowed users directory.", "danger");
        }
    };

    // Render Users Table rows
    const renderUsersTable = (users) => {
        usersTableBody.innerHTML = "";
        if (users.length === 0) {
            usersTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No accounts configured.</td></tr>`;
            return;
        }

        users.forEach(user => {
            const tr = document.createElement("tr");
            
            const isBlocked = user.blocked;
            const roleBadgeClass = user.role === "ADMIN" ? "role-admin" : "role-user";
            const statusBadgeClass = isBlocked ? "status-blocked" : "status-active";
            const statusText = isBlocked ? "Blocked" : "Active";
            
            // Build action buttons
            let actionButtons = "";
            if (user.role !== "ADMIN") {
                actionButtons += isBlocked 
                    ? `<button class="btn-table btn-table-unblock" onclick="unblockUser('${user.username}')"><i class="fa-solid fa-circle-check"></i> Unblock</button>`
                    : `<button class="btn-table btn-table-block" onclick="blockUser('${user.username}')"><i class="fa-solid fa-user-slash"></i> Block</button>`;
                
                actionButtons += `
                    <button class="btn-table btn-table-pass" onclick="changeUserPassword('${user.username}')"><i class="fa-solid fa-key"></i> Pass</button>
                    <button class="btn-table btn-table-delete" onclick="deleteUser('${user.username}')"><i class="fa-solid fa-trash-can"></i> Delete</button>
                `;
            } else {
                actionButtons = `<span style="font-size: 11px; color: rgba(255,255,255,0.3); font-style: italic;">Primary Owner (Fixed)</span>`;
            }

            tr.innerHTML = `
                <td><strong>${user.name}</strong></td>
                <td><span style="font-family: monospace; font-size: 13px;">${user.username}</span></td>
                <td><span class="role-badge ${roleBadgeClass}">${user.role}</span></td>
                <td>${user.createdAt || "N/A"}</td>
                <td><span class="status-badge ${statusBadgeClass}">${statusText}</span></td>
                <td style="text-align: right; display: flex; gap: 6px; justify-content: flex-end; align-items: center;">${actionButtons}</td>
            `;
            usersTableBody.appendChild(tr);
        });
    };

    // User actions global triggers
    window.blockUser = async (username) => {
        try {
            const res = await fetch(`${API}/api/admin/block-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentToken}`
                },
                body: JSON.stringify({ username })
            });
            const data = await res.json();
            showAdminAlert(data.message, data.success ? "success" : "danger");
            if (data.success) fetchAdminUsers();
        } catch {
            showAdminAlert("Action failed.", "danger");
        }
    };

    window.unblockUser = async (username) => {
        try {
            const res = await fetch(`${API}/api/admin/unblock-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentToken}`
                },
                body: JSON.stringify({ username })
            });
            const data = await res.json();
            showAdminAlert(data.message, data.success ? "success" : "danger");
            if (data.success) fetchAdminUsers();
        } catch {
            showAdminAlert("Action failed.", "danger");
        }
    };

    window.deleteUser = async (username) => {
        if (!confirm(`Delete user account "${username}" permanently?`)) return;
        try {
            const res = await fetch(`${API}/api/admin/delete-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentToken}`
                },
                body: JSON.stringify({ username })
            });
            const data = await res.json();
            showAdminAlert(data.message, data.success ? "success" : "danger");
            if (data.success) fetchAdminUsers();
        } catch {
            showAdminAlert("Action failed.", "danger");
        }
    };

    window.changeUserPassword = async (username) => {
        const newPassword = prompt(`Enter new password for "${username}":`);
        if (!newPassword) return;
        
        try {
            const res = await fetch(`${API}/api/admin/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentToken}`
                },
                body: JSON.stringify({ username, newPassword })
            });
            const data = await res.json();
            showAdminAlert(data.message, data.success ? "success" : "danger");
        } catch {
            showAdminAlert("Action failed.", "danger");
        }
    };

    // Add User submit handler
    addUserForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = newUserId.value.trim();
        const password = newUserPass.value;
        const name = newUserName.value.trim();

        try {
            const res = await fetch(`${API}/api/admin/add-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentToken}`
                },
                body: JSON.stringify({ username, password, name })
            });
            const data = await res.json();
            showAdminAlert(data.message, data.success ? "success" : "danger");
            if (data.success) {
                newUserId.value = "";
                newUserPass.value = "";
                newUserName.value = "";
                addUserBox.style.display = "none";
                fetchAdminUsers();
            }
        } catch {
            showAdminAlert("Failed to create user account.", "danger");
        }
    });

    // Start Session verification on load
    checkSession();
});

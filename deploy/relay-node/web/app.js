(function () {
  "use strict";

  var TOKEN_KEY = "relayNodeToken";
  var token = sessionStorage.getItem(TOKEN_KEY) || "";
  var refreshTimer = null;

  var $ = function (id) { return document.getElementById(id); };

  function api(path, options) {
    options = options || {};
    options.headers = options.headers || {};
    options.headers["Authorization"] = "Bearer " + token;
    if (options.body && typeof options.body !== "string") {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(options.body);
    }
    return fetch(path, options).then(function (response) {
      return response.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        if (response.status === 401) {
          logout();
          throw new Error(data && data.error ? data.error : "登录已失效");
        }
        if (!response.ok) {
          throw new Error((data && data.error) || ("HTTP " + response.status));
        }
        return data;
      });
    });
  }

  function showError(message) {
    var el = $("login-error");
    el.textContent = message;
    el.hidden = false;
  }

  function formatTime(value) {
    if (!value) return "—";
    var d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleString("zh-CN", { hour12: false });
  }

  function formatUptime(ms) {
    if (typeof ms !== "number") return "—";
    var s = Math.floor(ms / 1000);
    var d = Math.floor(s / 86400); s -= d * 86400;
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60); s -= m * 60;
    if (d) return d + "天 " + h + "小时";
    if (h) return h + "小时 " + m + "分";
    if (m) return m + "分 " + s + "秒";
    return s + "秒";
  }

  // --- login -------------------------------------------------------------
  $("login-form").addEventListener("submit", function (event) {
    event.preventDefault();
    $("login-error").hidden = true;
    var value = $("token-input").value.trim();
    if (!value) return showError("请输入管理令牌");
    fetch("/admin/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: value }),
    })
      .then(function (r) {
        return r.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) {}
          if (!r.ok) throw new Error((data && data.error) || "登录失败");
          return data;
        });
      })
      .then(function (data) {
        token = data.token;
        sessionStorage.setItem(TOKEN_KEY, token);
        enterApp();
      })
      .catch(function (error) { showError(error.message); });
  });

  function logout() {
    token = "";
    sessionStorage.removeItem(TOKEN_KEY);
    if (refreshTimer) clearInterval(refreshTimer);
    $("app").hidden = true;
    $("login").hidden = false;
    $("token-input").value = "";
  }
  $("logout").addEventListener("click", function () {
    api("/admin/api/logout", { method: "POST" }).catch(function () {});
    logout();
  });

  // --- tabs --------------------------------------------------------------
  function activateTab(name) {
    var tabs = document.querySelectorAll(".tab");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle("active", tabs[i].getAttribute("data-tab") === name);
    }
    var panels = document.querySelectorAll(".tab-panel");
    for (var j = 0; j < panels.length; j++) {
      panels[j].hidden = panels[j].id !== "tab-" + name;
    }
    if (name === "logs") loadLogs();
    if (name === "identities") loadIdentities();
    if (name === "shares") loadShares();
    if (name === "settings") loadSettings();
  }
  var tabButtons = document.querySelectorAll(".tab");
  for (var t = 0; t < tabButtons.length; t++) {
    tabButtons[t].addEventListener("click", function () {
      activateTab(this.getAttribute("data-tab"));
    });
  }

  // --- data loading ------------------------------------------------------
  function loadOverview() {
    api("/admin/api/overview").then(function (data) {
      $("stat-uptime").textContent = formatUptime(data.uptime);
      $("stat-identities").textContent = data.identities;
      $("stat-shares").textContent = data.shares;
      $("stat-logs").textContent = data.totalLogs;
      $("status-text").textContent = "运行中 · 代理" + (data.proxyMode === "token" ? "需令牌" : "开放");
    }).catch(function () {});
  }

  function loadLogs() {
    var category = $("log-category").value;
    var level = $("log-level").value;
    var query = "?limit=300";
    if (category) query += "&category=" + encodeURIComponent(category);
    if (level) query += "&level=" + encodeURIComponent(level);
    api("/admin/api/logs" + query).then(function (rows) {
      var tbody = document.querySelector("#logs-table tbody");
      tbody.innerHTML = "";
      if (!rows || !rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">暂无日志</td></tr>';
        return;
      }
      rows.forEach(function (row) {
        var tr = document.createElement("tr");
        var detail = row.detail
          ? Object.keys(row.detail).map(function (k) { return k + "=" + row.detail[k]; }).join(" ")
          : "";
        tr.innerHTML =
          "<td>" + formatTime(row.at) + "</td>" +
          '<td><span class="level ' + row.level + '">' + row.level + "</span></td>" +
          '<td class="cat">' + escapeHtml(row.category) + "</td>" +
          "<td>" + escapeHtml(row.message) + "</td>" +
          '<td class="detail">' + escapeHtml(detail) + "</td>";
        tbody.appendChild(tr);
      });
    }).catch(function () {});
  }

  function loadIdentities() {
    api("/admin/api/identities").then(function (rows) {
      var tbody = document.querySelector("#identities-table tbody");
      tbody.innerHTML = "";
      if (!rows || !rows.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty">暂无密钥</td></tr>';
        return;
      }
      rows.forEach(function (row) {
        var tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" + escapeHtml(row.name) + "</td>" +
          '<td class="detail">' + escapeHtml(row.fingerprint) + "</td>" +
          "<td>" + formatTime(row.registeredAt) + "</td>";
        tbody.appendChild(tr);
      });
    }).catch(function () {});
  }

  function loadShares() {
    api("/admin/api/shares").then(function (rows) {
      var tbody = document.querySelector("#shares-table tbody");
      tbody.innerHTML = "";
      if (!rows || !rows.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">暂无分享</td></tr>';
        return;
      }
      rows.forEach(function (row) {
        var tr = document.createElement("tr");
        var cells =
          '<td class="detail">' + escapeHtml(row.id) + "</td>" +
          "<td>" + escapeHtml(row.ownerName) + "</td>" +
          "<td>" + escapeHtml((row.recipientNames || []).join(", ")) + "</td>" +
          "<td>" + escapeHtml(row.url || "") + "</td>" +
          "<td>" + formatTime(row.updatedAt) + "</td>";
        tr.innerHTML = cells + '<td><button class="ghost danger revoke" data-id="' + escapeAttr(row.id) + '">撤销</button></td>';
        tbody.appendChild(tr);
      });
      var buttons = tbody.querySelectorAll(".revoke");
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener("click", function () {
          var id = this.getAttribute("data-id");
          if (!confirm("确定撤销分享 " + id + " 吗？")) return;
          api("/admin/api/shares/" + encodeURIComponent(id), { method: "DELETE" })
            .then(function () { loadShares(); loadOverview(); })
            .catch(function (error) { alert(error.message); });
        });
      }
    }).catch(function () {});
  }

  function loadSettings() {
    api("/admin/api/settings").then(function (data) {
      $("setting-proxy-token").checked = Boolean(data.proxyRequiresToken);
    }).catch(function () {});
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function escapeAttr(value) { return escapeHtml(value); }

  // --- controls ----------------------------------------------------------
  $("refresh-logs").addEventListener("click", loadLogs);
  $("log-category").addEventListener("change", loadLogs);
  $("log-level").addEventListener("change", loadLogs);
  $("clear-logs").addEventListener("click", function () {
    if (!confirm("确定清空所有日志吗？")) return;
    api("/admin/api/logs", { method: "DELETE" })
      .then(function () { loadLogs(); loadOverview(); })
      .catch(function (error) { alert(error.message); });
  });
  $("auto-refresh").addEventListener("change", function () { startAutoRefresh(); });
  $("copy-url").addEventListener("click", function () {
    var input = $("node-url");
    input.select();
    try { document.execCommand("copy"); } catch (e) {}
    if (navigator.clipboard) navigator.clipboard.writeText(input.value).catch(function () {});
    $("copy-url").textContent = "已复制";
    setTimeout(function () { $("copy-url").textContent = "复制"; }, 1500);
  });

  $("save-settings").addEventListener("click", function () {
    var payload = { proxyRequiresToken: $("setting-proxy-token").checked };
    var newToken = $("setting-new-token").value.trim();
    if (newToken) payload.adminToken = newToken;
    api("/admin/api/settings", { method: "POST", body: payload })
      .then(function () {
        var msg = $("settings-msg");
        msg.textContent = "设置已保存" + (newToken ? "，管理令牌已更新，下次登录请使用新令牌" : "");
        msg.hidden = false;
        $("setting-new-token").value = "";
        loadOverview();
      })
      .catch(function (error) { alert(error.message); });
  });

  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    if (!$("auto-refresh").checked) return;
    refreshTimer = setInterval(function () {
      loadOverview();
      var active = document.querySelector(".tab.active");
      if (active && active.getAttribute("data-tab") === "logs") loadLogs();
    }, 5000);
  }

  function enterApp() {
    $("login").hidden = true;
    $("app").hidden = false;
    // location.pathname is "/admin" here; strip it so the extension gets the
    // bare relay origin (or the configured sub-path when behind a reverse proxy).
    var base = location.pathname.replace(/\/admin\/?$/, "").replace(/\/$/, "");
    $("node-url").value = location.origin + base + "/";
    loadOverview();
    activateTab("logs");
    startAutoRefresh();
  }

  if (token) {
    api("/admin/api/overview").then(enterApp).catch(function () { logout(); });
  }
})();

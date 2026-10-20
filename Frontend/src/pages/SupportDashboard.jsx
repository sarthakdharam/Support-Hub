import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { apiFetch } from "../api"
import "./support-dashboard.css"

const roleLabels = { super_admin: "Super Admin", tech_admin: "Tech Admin", team_member: "Team Member" }
const menus = {
    super_admin: [["Overview", "▦"], ["Departments", "▥"], ["Tech admins", "♙"], ["Team members", "♧"], ["All tickets", "▣"], ["Ticket history", "◷"], ["Audit logs", "⌁"]],
    tech_admin: [["Overview", "▦"], ["All tickets", "▣"], ["Create ticket", "+"], ["Team members", "♧"], ["Departments", "▥"], ["Ticket history", "◷"]],
    team_member: [["Overview", "▦"], ["My tickets", "▣"], ["Ticket history", "◷"], ["Profile", "♙"]]
}

function SupportDashboard({ role }) {
    const navigate = useNavigate()
    const token = localStorage.getItem("accessToken")
    const [section, setSection] = useState("Overview")
    const [tickets, setTickets] = useState([])
    const [history, setHistory] = useState([])
    const [departments, setDepartments] = useState([])
    const [members, setMembers] = useState([])
    const [admins, setAdmins] = useState([])
    const [loading, setLoading] = useState(true)
    const [query, setQuery] = useState("")
    const [error, setError] = useState("")

    const load = useCallback(async () => {
        if (!token) { navigate("/login"); return }
        setLoading(true); setError("")
        const get = async (path) => {
            const response = await apiFetch(path)
            if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message || `Could not load ${path}`) }
            return response.json()
        }
        try {
            const requests = [get(role === "team_member" ? "my/tickets" : "ticket"), role === "team_member" ? Promise.resolve([]) : get("tickethistory"), role === "team_member" ? Promise.resolve([]) : get("department")]
            if (role === "tech_admin") requests.push(get("team_member"))
            if (role === "super_admin") requests.push(get("tech_admin"))
            const values = await Promise.all(requests)
            setTickets(values[0]); setHistory(values[1]); setDepartments(values[2])
            if (role === "tech_admin") setMembers(values[3])
            if (role === "super_admin") setAdmins(values[3])
        } catch (e) { setError(e.message) } finally { setLoading(false) }
    }, [navigate, role, token])

    useEffect(() => { load() }, [load])

    const myTickets = tickets
    const counts = useMemo(() => ({ total: myTickets.length, open: myTickets.filter(t => t.status === "Open").length, progress: myTickets.filter(t => t.status === "In Progress").length, resolved: myTickets.filter(t => ["Resolved", "Closed"].includes(t.status)).length }), [myTickets])
    const filtered = myTickets.filter(t => `${t.ticket_id} ${t.subject} ${t.department?.dept_name} ${t.team_member?.name} ${t.status}`.toLowerCase().includes(query.toLowerCase()))
    const title = section === "Overview" ? `${roleLabels[role]} Dashboard` : section

    async function updateTicket(ticket, operation) {
        try {
            const response = await apiFetch("ticket", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket_id: String(ticket.ticket_id), [operation]: true }) })
            const data = await response.json()
            if (!response.ok) throw new Error(data.message || "Could not update ticket")
            await load()
        } catch (e) { setError(e.message) }
    }

    function logout() { localStorage.removeItem("accessToken"); localStorage.removeItem("refreshToken"); localStorage.removeItem("role"); navigate("/login") }

    const recent = [...tickets].slice(0, 6)
    const rows = section === "My tickets" ? filtered : filtered

    return <div className="sh-app">
        <aside className="sh-sidebar">
            <div className="sh-brand"><span className="sh-mark">◉</span><span>Support<span>Hub</span><small>TICKETS · PEOPLE · SOLUTIONS</small></span></div>
            <div className="sh-nav-label">WORKSPACE</div>
            <nav>{menus[role].map(([name, icon]) => <button key={name} className={section === name ? "active" : ""} onClick={() => setSection(name)}><span className="sh-nav-icon">{icon}</span>{name}</button>)}</nav>
            <button className="sh-logout" onClick={logout}><span className="sh-nav-icon">↪</span>Log out</button>
        </aside>
        <main className="sh-main">
            <header className="sh-topbar"><button className="sh-mobile-menu" aria-label="Toggle menu" onClick={() => document.querySelector(".sh-sidebar")?.classList.toggle("show")}>☰</button><div className="sh-crumb">{title}</div><div className="sh-account"><button aria-label="Notifications" className="sh-bell">♧<i /></button><span className="sh-avatar">{roleLabels[role][0]}</span><span className="sh-account-name">{roleLabels[role]}<small>{roleLabels[role]}</small></span><span className="sh-caret">⌄</span></div></header>
            <div className="sh-content">
                {section === "Overview" && <><div className="sh-welcome"><div><p className="sh-eyebrow">SUPPORTHUB WORKSPACE</p><h1>Your team, in control<span>.</span></h1><p className="sh-subtitle">A clear view of the support work that needs your attention.</p></div>{role === "tech_admin" && <button className="sh-primary" onClick={() => setSection("Create ticket")}>＋ Create ticket</button>}</div>
                    <div className="sh-stat-grid">{(role === "super_admin" ? [["Total tickets", counts.total, "▤", "blue"], ["Departments", departments.length, "▥", "orange"], ["Tech admins", admins.length, "♙", "purple"], ["Team members", members.length || "—", "♧", "green"]] : role === "tech_admin" ? [["Total tickets", counts.total, "▤", "blue"], ["Open tickets", counts.open, "▱", "orange"], ["In progress", counts.progress, "◌", "purple"], ["Resolved", counts.resolved, "✓", "green"]] : [["My tickets", counts.total, "▤", "blue"], ["Open", counts.open, "▱", "orange"], ["In progress", counts.progress, "◌", "purple"], ["Resolved", counts.resolved, "✓", "green"]]).map(([label, value, icon, color]) => <article className="sh-stat" key={label}><span className={`sh-stat-icon ${color}`}>{icon}</span><div><span>{label}</span><strong>{value}</strong><small>Current workload</small></div></article>)}</div>
                    <div className="sh-panels"><section className="sh-panel sh-wide"><div className="sh-panel-head"><div><h2>{role === "super_admin" ? "Ticket overview" : role === "team_member" ? "My ticket activity" : "Ticket activity"}</h2><p>Open work across your support team</p></div><button className="sh-link" onClick={() => setSection(role === "team_member" ? "My tickets" : "All tickets")}>View tickets ↗</button></div><div className="sh-chart"><div className="sh-chart-labels"><span>{counts.total}</span><span>{counts.progress}</span><span>{counts.open}</span><span>0</span></div><div className="sh-chart-area"><div className="sh-grid-lines"><i/><i/><i/><i/></div><svg viewBox="0 0 700 170" preserveAspectRatio="none" aria-label="Ticket status comparison"><polyline points="0,138 110,123 220,116 330,93 440,79 550,62 700,48"/><polyline className="line-purple" points="0,153 110,142 220,135 330,124 440,109 550,100 700,86"/><polyline className="line-green" points="0,162 110,155 220,146 330,135 440,126 550,113 700,105"/></svg><div className="sh-months"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span></div></div></div><div className="sh-legend"><span><i className="blue-dot"/>Open</span><span><i className="purple-dot"/>In progress</span><span><i className="green-dot"/>Resolved</span></div></section>
                        <section className="sh-panel sh-breakdown"><div className="sh-panel-head"><div><h2>Tickets by status</h2><p>Current distribution</p></div></div><div className="sh-donut-wrap"><div className="sh-donut"><div><strong>{counts.total}</strong><span>Tickets</span></div></div><div className="sh-donut-legend"><span><i className="blue-dot"/>Open <b>{counts.open}</b></span><span><i className="purple-dot"/>In progress <b>{counts.progress}</b></span><span><i className="green-dot"/>Resolved <b>{counts.resolved}</b></span></div></div></section>
                    </div>
                    <div className="sh-panels sh-lower"><TicketTable tickets={recent} role={role} onAction={updateTicket} onView={() => setSection(role === "team_member" ? "My tickets" : "All tickets")} /><Activity history={history.slice(0, 5)} onView={() => setSection("Ticket history")} /></div>
                </>}
                {section !== "Overview" && <section className="sh-panel sh-list-panel"><div className="sh-panel-head"><div><p className="sh-eyebrow">MANAGE YOUR WORK</p><h2>{section}</h2><p>Live information from your SupportHub workspace.</p></div>{section === "Create ticket" && <span className="sh-note">Ticket creation form is available through the ticket API.</span>}</div>
                    {section === "Ticket history" ? <HistoryTable history={history} /> : section === "Departments" ? <SimpleTable headers={["Department", "Responsibilities", "Status"]} rows={departments.map(d => [d.dept_name, d.Responsibilities || "—", d.is_active ? "Active" : "Inactive"])} /> : section === "Tech admins" ? <SimpleTable headers={["Name", "Username", "Branch", "Status"]} rows={admins.map(a => [a.name, a.username, a.branch, a.is_active ? "Active" : "Inactive"])} /> : section === "Team members" ? <SimpleTable headers={["Name", "Username", "Department", "Status"]} rows={members.map(m => [m.name, m.username, m.department?.dept_name || "—", m.is_active ? "Active" : "Inactive"])} /> : <><div className="sh-toolbar"><label className="sh-search">⌕<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tickets..." /></label><span>{filtered.length} tickets</span></div><TicketTable tickets={rows} role={role} onAction={updateTicket} /></>}
                </section>}
                {loading && <div className="sh-loading"><span className="sh-spinner"/>Loading workspace…</div>}{error && <div className="sh-error">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
            </div>
        </main>
    </div>
}

function TicketTable({ tickets, role, onAction, onView }) {
    return <section className="sh-panel sh-ticket-panel"><div className="sh-panel-head"><div><h2>Recent tickets</h2><p>Latest requests and their current owners</p></div>{onView && <button className="sh-link" onClick={onView}>View all ↗</button>}</div><div className="sh-table-scroll"><table><thead><tr><th>Ticket</th><th>Subject</th><th>Department</th><th>Assigned to</th><th>Priority</th><th>Status</th><th>Action</th></tr></thead><tbody>{tickets.length ? tickets.map(t => <tr key={t.id}><td className="sh-id">#{t.ticket_id}</td><td className="sh-subject">{t.subject}</td><td>{t.department?.dept_name || "—"}</td><td>{t.team_member?.name || "Unassigned"}</td><td><span className={`sh-priority ${(t.priority || "").toLowerCase()}`}>{t.priority}</span></td><td><span className={`sh-status ${(t.status || "").toLowerCase().replace(" ", "-")}`}>{t.status}</span></td><td>{role === "team_member" && t.status === "Open" ? <button className="sh-row-action" onClick={() => onAction(t, "start_work")}>Start</button> : role === "team_member" && t.status === "In Progress" ? <button className="sh-row-action" onClick={() => onAction(t, "resolve")}>Resolve</button> : <button className="sh-more" aria-label={`Ticket ${t.ticket_id} options`}>•••</button>}</td></tr>) : <tr><td colSpan="7" className="sh-empty">No tickets found.</td></tr>}</tbody></table></div></section>
}
function Activity({ history, onView }) { return <section className="sh-panel sh-activity"><div className="sh-panel-head"><div><h2>Recent activity</h2><p>Latest ticket updates</p></div><button className="sh-link" onClick={onView}>View all ↗</button></div><div className="sh-activity-list">{history.length ? history.map((h, i) => <div className="sh-activity-item" key={h.id}><span className={`sh-activity-icon a${i % 4}`}>{h.new_status === "Resolved" ? "✓" : "↻"}</span><div><p><b>{h.changed_by_member?.name || h.changed_by_admin?.username || "Support team"}</b> {h.note || `updated ticket #${h.ticket?.ticket_id}`}</p><small>Ticket #{h.ticket?.ticket_id} · {new Date(h.created_at).toLocaleString()}</small></div></div>) : <p className="sh-empty-text">No recent activity yet.</p>}</div></section> }
function HistoryTable({ history }) { return <div className="sh-table-scroll"><table><thead><tr><th>Ticket</th><th>Update</th><th>Changed by</th><th>Previous status</th><th>New status</th><th>When</th></tr></thead><tbody>{history.map(h => <tr key={h.id}><td className="sh-id">#{h.ticket?.ticket_id}</td><td>{h.note || "Ticket updated"}</td><td>{h.changed_by_member?.name || h.changed_by_admin?.username || "Support team"}</td><td>{h.old_status || "—"}</td><td>{h.new_status || "—"}</td><td>{new Date(h.created_at).toLocaleString()}</td></tr>)}</tbody></table></div> }
function SimpleTable({ headers, rows }) { return <div className="sh-table-scroll"><table><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length} className="sh-empty">No records found.</td></tr>}</tbody></table></div> }

export default SupportDashboard

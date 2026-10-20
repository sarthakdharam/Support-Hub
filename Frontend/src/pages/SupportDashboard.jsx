import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "react-toastify"
import { apiFetch } from "../api"
import "./support-dashboard.css"

const roleLabels = { super_admin: "Super Admin", tech_admin: "Tech Admin", team_member: "Team Member" }
const menus = {
    super_admin: [["Overview", "▦"], ["Departments", "▥"], ["Tech admins", "♙"], ["Team members", "♧"], ["All tickets", "▣"], ["Ticket history", "◷"]],
    tech_admin: [["Overview", "▦"], ["All tickets", "▣"], ["Create ticket", "+"], ["Team members", "♧"], ["Departments", "▥"], ["Ticket history", "◷"]],
    team_member: [["Overview", "▦"], ["My tickets", "▣"], ["Ticket history", "◷"]]
}

function statusDonut(counts) {
    if (!counts.total) return "#e9ecf5"
    const openEnd = counts.open / counts.total * 100
    const progressEnd = openEnd + counts.progress / counts.total * 100
    const resolvedEnd = progressEnd + counts.resolved / counts.total * 100
    return `conic-gradient(#4b82ff 0 ${openEnd}%, #6844ed ${openEnd}% ${progressEnd}%, #25bd8c ${progressEnd}% ${resolvedEnd}%, #e9ecf5 ${resolvedEnd}% 100%)`
}

function averageResolutionTime(tickets) {
    const durations = tickets
        .filter(ticket => ticket.created_at && ticket.resolved_at)
        .map(ticket => new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime())
        .filter(duration => Number.isFinite(duration) && duration >= 0)
    if (!durations.length) return "—"
    const minutes = Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length / 60000)
    if (minutes < 60) return `${minutes} min`
    const hours = minutes / 60
    if (hours < 24) return `${hours.toFixed(1)} hrs`
    const wholeHours = Math.round(hours)
    const days = Math.floor(wholeHours / 24)
    const remainingHours = wholeHours % 24
    return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`
}

function validateEntry(section, values) {
    const errors = {}
    const fields = section === "Create ticket"
        ? { subject: "Subject", description: "Description", department: "Department", member: "Assignee", priority: "Priority", due_at: "Due date" }
        : section === "Departments"
            ? { dept_name: "Department name", Responsibilities: "Responsibilities" }
            : section === "Tech admins"
                ? { username: "Username", name: "Name", email: "Email", phone: "Phone", password: "Password", branch: "Branch", address: "Address" }
                : section === "Team members"
                    ? { username: "Username", name: "Name", email: "Email", phone: "Phone", password: "Password", department: "Department", address: "Address" }
                    : {}

    for (const [name, label] of Object.entries(fields)) {
        if (typeof values[name] !== "string" || !values[name].trim()) errors[name] = `${label} is required.`
    }
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Enter a valid email address."
    if (values.phone && !/^\d{10}$/.test(values.phone.trim())) errors.phone = "Enter a 10 digit phone number."
    if (values.password && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=])[A-Za-z\d@$!%*?&#^()_+\-=]{8,}$/.test(values.password)) {
        errors.password = "Use 8+ characters with uppercase, lowercase, a number, and a special character."
    }
    if (section === "Create ticket" && values.due_at) {
        const now = new Date()
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
        if (values.due_at <= today) errors.due_at = "Choose a due date in the future."
    }
    if (section === "My profile" && values.phone && !/^\d{10}$/.test(values.phone.trim())) errors.phone = "Enter a 10 digit phone number."
    if (section === "My profile" && values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Enter a valid email address."
    if (section === "My profile" && values.profile_photo?.size > 2 * 1024 * 1024) errors.profile_photo = "Choose an image smaller than 2 MB."
    if (section === "My profile" && values.profile_photo?.size && !["image/png", "image/jpeg", "image/webp"].includes(values.profile_photo.type)) errors.profile_photo = "Choose a PNG, JPEG, or WebP image."
    return errors
}

function fieldForError(section, message) {
    const lower = message.toLowerCase()
    const fields = section === "Create ticket"
        ? [["subject", /subject/], ["description", /description/], ["department", /department/], ["member", /member|assignee|ticket limit/], ["priority", /priority/], ["due_at", /due date|due_at/]]
        : section === "Departments"
            ? [["dept_name", /department name|dept_name|already exists/], ["Responsibilities", /responsibilit/]]
            : section === "Tech admins"
                ? [["username", /username/], ["name", /name/], ["email", /email/], ["phone", /phone/], ["password", /password/], ["branch", /branch/], ["address", /address/]]
                : section === "Team members"
                    ? [["username", /username/], ["name", /name/], ["email", /email/], ["phone", /phone/], ["password", /password/], ["department", /department/], ["address", /address/]]
                    : [["name", /name/], ["email", /email/], ["phone", /phone/], ["password", /password/], ["address", /address/], ["profile_photo", /profile photo|image/]]
    return fields.find(([, pattern]) => pattern.test(lower))?.[0]
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
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [query, setQuery] = useState("")
    const [fieldErrors, setFieldErrors] = useState({})
    const [formOpen, setFormOpen] = useState(false)
    const [profileMenuOpen, setProfileMenuOpen] = useState(false)
    const [profileEditOpen, setProfileEditOpen] = useState(false)

    const load = useCallback(async () => {
        if (!token) { navigate("/login"); return }
        setLoading(true)
        const get = async (path) => {
            const response = await apiFetch(path)
            if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message || `Could not load ${path}`) }
            return response.json()
        }
        try {
            const requests = [get(role === "team_member" ? "my/tickets" : "ticket"), get(role === "team_member" ? "my/tickethistory" : "tickethistory"), role === "team_member" ? Promise.resolve([]) : get("department")]
            if (role === "tech_admin") requests.push(get("team_member"))
            if (role === "super_admin") requests.push(get("tech_admin"), get("team_member"))
            if (role !== "super_admin") requests.push(get("profile"))
            const values = await Promise.all(requests)
            setTickets(values[0]); setHistory(values[1]); setDepartments(values[2])
            if (role === "tech_admin") setMembers(values[3])
            if (role === "super_admin") { setAdmins(values[3]); setMembers(values[4]) }
            if (role === "tech_admin") setProfile(values[4])
            if (role === "team_member") setProfile(values[3])
        } catch (e) { toast.error(e.message) } finally { setLoading(false) }
    }, [navigate, role, token])

    useEffect(() => {
        const timer = window.setTimeout(() => { void load() }, 0)
        return () => window.clearTimeout(timer)
    }, [load])

    const myTickets = tickets
    const counts = useMemo(() => ({ total: myTickets.length, open: myTickets.filter(t => t.status === "Open").length, progress: myTickets.filter(t => t.status === "In Progress").length, resolved: myTickets.filter(t => ["Resolved", "Closed"].includes(t.status)).length }), [myTickets])
    const monthlyActivity = useMemo(() => {
        const months = Array.from({ length: 6 }, (_, index) => {
            const date = new Date()
            date.setDate(1)
            date.setMonth(date.getMonth() - (5 - index))
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
            const events = history.filter(item => {
                const createdAt = new Date(item.created_at)
                return `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}` === key
            })
            return {
                key,
                label: date.toLocaleString(undefined, { month: "short" }),
                open: events.filter(item => item.new_status === "Open").length,
                progress: events.filter(item => item.new_status === "In Progress").length,
                resolved: events.filter(item => ["Resolved", "Closed"].includes(item.new_status)).length
            }
        })
        const max = Math.max(1, ...months.flatMap(month => [month.open, month.progress, month.resolved]))
        const points = key => months.map((month, index) => `${(index / (months.length - 1)) * 700},${150 - (month[key] / max) * 125}`).join(" ")
        return { months, max, open: points("open"), progress: points("progress"), resolved: points("resolved") }
    }, [history])
    const filtered = myTickets.filter(t => `${t.ticket_id} ${t.subject} ${t.department?.dept_name} ${t.team_member?.name} ${t.status}`.toLowerCase().includes(query.toLowerCase()))
    const title = section === "Overview" ? `${roleLabels[role]} Dashboard` : section
    const canOpenForm = (section === "Create ticket" && role === "tech_admin") ||
        (section === "Team members" && role === "tech_admin") ||
        (role === "super_admin" && ["Departments", "Tech admins"].includes(section))

    async function updateTicket(ticket, operation, details = {}) {
        try {
            const response = await apiFetch("ticket", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket_id: String(ticket.ticket_id), [operation]: true, ...details }) })
            const data = await response.json()
            if (!response.ok) throw new Error(data.message || "Could not update ticket")
            await load()
        } catch (e) { toast.error(e.message) }
    }

    async function submitForm(event, formSection = section) {
        event.preventDefault()
        const formElement = event.currentTarget
        const formData = Object.fromEntries(new FormData(formElement).entries())
        const validationErrors = validateEntry(formSection, formData)
        if (Object.keys(validationErrors).length) {
            setFieldErrors(validationErrors)
            toast.error(Object.values(validationErrors)[0])
            return
        }
        setFieldErrors({})
        try {
            let path = ""
            let method = "POST"
            let payload = formData
            if (formSection === "Create ticket") path = "ticket"
            else if (formSection === "Departments") path = "department"
            else if (formSection === "Tech admins") path = "tech_admin"
            else if (formSection === "Team members") path = "team_member"
            else if (formSection === "My profile") {
                path = role === "tech_admin" ? "tech_admin" : "team_member"
                method = "PATCH"
                payload = { ...formData }
                const file = formElement.elements.profile_photo?.files?.[0]
                if (file) payload.profile_photo_data_url = await new Promise((resolve, reject) => {
                    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file)
                })
                delete payload.profile_photo
            }
            const response = await apiFetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
            const result = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(result.message || "Could not save changes")
            setFormOpen(false)
            setProfileEditOpen(false)
            toast.success(formSection === "My profile" ? "Your profile was updated." : `${formSection === "Create ticket" ? "Ticket" : formSection === "Departments" ? "Department" : formSection === "Tech admins" ? "Tech admin" : "Team member"} created successfully.`)
            await load()
            if (formSection === "Create ticket") setSection(role === "team_member" ? "My tickets" : "All tickets")
        } catch (e) {
            const field = fieldForError(formSection, e.message)
            if (field) setFieldErrors({ [field]: e.message })
            toast.error(e.message)
        }
    }

    function logout() { localStorage.removeItem("accessToken"); localStorage.removeItem("refreshToken"); localStorage.removeItem("role"); navigate("/login") }
    function selectSection(nextSection) {
        setSection(nextSection)
        setFormOpen(nextSection === "Create ticket")
    }

    const recent = [...tickets].slice(0, 6)
    const rows = section === "My tickets" ? filtered : filtered

    return <div className="sh-app">
        <aside className="sh-sidebar">
            <div className="sh-brand"><span className="sh-mark">◉</span><span>Support<span>Hub</span><small>TICKETS · PEOPLE · SOLUTIONS</small></span></div>
            <div className="sh-nav-label">WORKSPACE</div>
            <nav>{menus[role].map(([name, icon]) => <button key={name} className={section === name ? "active" : ""} onClick={() => selectSection(name)}><span className="sh-nav-icon">{icon}</span>{name}</button>)}</nav>
            <button className="sh-logout" onClick={logout}><span className="sh-nav-icon">↪</span>Log out</button>
        </aside>
        <main className="sh-main">
            <header className="sh-topbar"><button className="sh-mobile-menu" aria-label="Toggle menu" onClick={() => document.querySelector(".sh-sidebar")?.classList.toggle("show")}>☰</button><div className="sh-crumb">{title}</div><div className="sh-account"><button className="sh-profile-trigger" aria-haspopup="dialog" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen(value => !value)}><span className="sh-avatar">{profile?.profile_photo_data_url ? <img src={profile.profile_photo_data_url} alt="" /> : (profile?.name || profile?.username || roleLabels[role])[0]}</span><span className="sh-account-name">{profile?.name || profile?.username || roleLabels[role]}<small>{roleLabels[role]}</small></span><span className="sh-caret">⌄</span></button>{profileMenuOpen && <div className="sh-profile-menu" role="dialog" aria-label="Your profile"><div className="sh-profile-menu-heading"><b>{profile?.name || profile?.username || roleLabels[role]}</b><span>{roleLabels[role]}</span></div><dl><dt>Email</dt><dd>{profile?.email || "Not added"}</dd><dt>Phone</dt><dd>{profile?.phone || "Not added"}</dd>{profile?.department?.dept_name && <><dt>Department</dt><dd>{profile.department.dept_name}</dd></>}</dl>{role !== "super_admin" && <button className="sh-primary" onClick={() => { setProfileMenuOpen(false); setProfileEditOpen(true) }}>Edit profile</button>}</div>}</div></header>
            <div className="sh-content">
                {section === "Overview" && <><div className="sh-welcome"><div><p className="sh-eyebrow">SUPPORTHUB WORKSPACE</p><h1>Welcome, {profile?.name || profile?.username || roleLabels[role]}<span>!</span></h1><p className="sh-subtitle">A clear view of the support work that needs your attention.</p></div>{role === "tech_admin" && <button className="sh-primary" onClick={() => selectSection("Create ticket")}>＋ Create ticket</button>}</div>
                    <div className="sh-stat-grid">{(role === "super_admin" ? [["Total tickets", counts.total, "▤", "blue"], ["Departments", departments.length, "▥", "orange"], ["Tech admins", admins.length, "♙", "purple"], ["Team members", members.length, "♧", "green"]] : role === "tech_admin" ? [["Total tickets", counts.total, "▤", "blue"], ["Open tickets", counts.open, "▱", "orange"], ["In progress", counts.progress, "◌", "purple"], ["Resolved", counts.resolved, "✓", "green"]] : [["My tickets", counts.total, "▤", "blue"], ["Open", counts.open, "▱", "orange"], ["In progress", counts.progress, "◌", "purple"], ["Resolved", counts.resolved, "✓", "green"]]).concat([["Avg. resolution", averageResolutionTime(myTickets), "◷", "purple"]]).map(([label, value, icon, color]) => <article className="sh-stat" key={label}><span className={`sh-stat-icon ${color}`}>{icon}</span><div><span>{label}</span><strong>{value}</strong><small>{label === "Avg. resolution" ? "Resolved tickets" : "Current workload"}</small></div></article>)}</div>
                    <div className="sh-panels"><section className="sh-panel sh-wide"><div className="sh-panel-head"><div><h2>Ticket status updates</h2><p>Monthly status changes from ticket history</p></div><button className="sh-link" onClick={() => selectSection(role === "team_member" ? "My tickets" : "All tickets")}>View tickets ↗</button></div><div className="sh-chart"><div className="sh-chart-labels"><span>{monthlyActivity.max}</span><span>{Math.round(monthlyActivity.max * 2 / 3)}</span><span>{Math.round(monthlyActivity.max / 3)}</span><span>0</span></div><div className="sh-chart-area"><div className="sh-grid-lines"><i/><i/><i/><i/></div><svg viewBox="0 0 700 170" preserveAspectRatio="none" aria-label="Monthly ticket status updates"><polyline points={monthlyActivity.open}/><polyline className="line-purple" points={monthlyActivity.progress}/><polyline className="line-green" points={monthlyActivity.resolved}/></svg><div className="sh-months">{monthlyActivity.months.map(month => <span key={month.key}>{month.label}</span>)}</div></div></div><div className="sh-legend"><span><i className="blue-dot"/>Opened</span><span><i className="purple-dot"/>In progress</span><span><i className="green-dot"/>Resolved/closed</span></div></section>
                        <section className="sh-panel sh-breakdown"><div className="sh-panel-head"><div><h2>Tickets by status</h2><p>Current distribution</p></div></div><div className="sh-donut-wrap"><div className="sh-donut" style={{ background: statusDonut(counts) }}><div><strong>{counts.total}</strong><span>Tickets</span></div></div><div className="sh-donut-legend"><span><i className="blue-dot"/>Open <b>{counts.open}</b></span><span><i className="purple-dot"/>In progress <b>{counts.progress}</b></span><span><i className="green-dot"/>Resolved <b>{counts.resolved}</b></span></div></div></section>
                    </div>
                    <div className="sh-panels sh-lower"><TicketTable tickets={recent} role={role} members={members} departments={departments} onAction={updateTicket} onView={() => selectSection(role === "team_member" ? "My tickets" : "All tickets")} /><Activity history={history.slice(0, 5)} onView={() => selectSection("Ticket history")} /></div>
                </>}
                {section !== "Overview" && <section className="sh-panel sh-list-panel"><div className="sh-panel-head"><div><p className="sh-eyebrow">MANAGE YOUR WORK</p><h2>{section}</h2><p>Live information from your SupportHub workspace.</p></div>{canOpenForm && <button className="sh-primary" onClick={() => setFormOpen(!formOpen)}>{formOpen ? "Close form" : section === "My profile" ? "Edit my profile" : `＋ ${section === "Create ticket" ? "New ticket" : section === "Departments" ? "New department" : section === "Tech admins" ? "New tech admin" : "New team member"}`}</button>}</div>
                    {formOpen && <div className="sh-modal-backdrop" onClick={() => setFormOpen(false)}><section className="sh-form-modal" role="dialog" aria-modal="true" aria-labelledby="sh-form-title" onClick={event => event.stopPropagation()}><div className="sh-modal-head"><span className="sh-modal-mark">{section === "My profile" ? "♙" : section === "Create ticket" ? "＋" : section === "Departments" ? "▥" : section === "Tech admins" ? "♙" : "♧"}</span><div><p className="sh-eyebrow">SUPPORTHUB WORKSPACE</p><h3 id="sh-form-title">{section === "My profile" ? "Update your profile" : section === "Create ticket" ? "Create a ticket" : `Create ${section === "Departments" ? "a department" : section === "Tech admins" ? "a tech admin" : "a team member"}`}</h3><p>{section === "My profile" ? "Your account details are yours to manage." : section === "Create ticket" ? "Add the request details and assign it to an available teammate." : "Enter the details below to add this to your workspace."}</p></div><button className="sh-modal-close" type="button" aria-label="Close form" onClick={() => setFormOpen(false)}>×</button></div><EntryForm section={section} departments={departments} members={members} profile={profile} fieldErrors={fieldErrors} onClearField={name => setFieldErrors(errors => ({ ...errors, [name]: undefined }))} onSubmit={submitForm} /></section></div>}
                    {!formOpen && (section === "Ticket history" ? <HistoryTable history={history} /> : section === "Departments" ? <SimpleTable headers={["Department", "Responsibilities", "Active members", "Status"]} rows={departments.map(d => [d.dept_name, d.Responsibilities || "—", members.filter(m => m.is_active && m.department?.id === d.id).length, d.is_active ? "Active" : "Inactive"])} /> : section === "Tech admins" ? <SimpleTable headers={["Name", "Username", "Branch", "Status"]} rows={admins.map(a => [a.name, a.username, a.branch, a.is_active ? "Active" : "Inactive"])} /> : section === "Team members" ? <SimpleTable headers={["Name", "Username", "Department", "Status", "Active tickets"]} rows={members.map(m => [m.name, m.username, m.department?.dept_name || "—", m.is_active ? "Active" : "Inactive", m.active_tickets ?? "—"])} /> : section === "Create ticket" ? null : <><div className="sh-toolbar"><label className="sh-search">⌕<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tickets..." /></label><span>{filtered.length} tickets</span></div><TicketTable tickets={rows} role={role} members={members} departments={departments} onAction={updateTicket} /></>)}
                </section>}
                    {profileEditOpen && <div className="sh-modal-backdrop" onClick={() => setProfileEditOpen(false)}><section className="sh-form-modal" role="dialog" aria-modal="true" aria-labelledby="sh-profile-title" onClick={event => event.stopPropagation()}><div className="sh-modal-head"><span className="sh-modal-mark">♙</span><div><p className="sh-eyebrow">YOUR ACCOUNT</p><h3 id="sh-profile-title">Edit your profile</h3><p>Update your personal details and profile photo.</p></div><button className="sh-modal-close" type="button" aria-label="Close profile editor" onClick={() => setProfileEditOpen(false)}>×</button></div><EntryForm section="My profile" departments={departments} members={members} profile={profile} fieldErrors={fieldErrors} onClearField={name => setFieldErrors(errors => ({ ...errors, [name]: undefined }))} onSubmit={event => submitForm(event, "My profile")} /></section></div>}
                    {loading && <div className="sh-loading"><span className="sh-spinner"/>Loading workspace…</div>}
            </div>
        </main>
    </div>
}

function TicketTable({ tickets, role, members = [], departments = [], onAction, onView }) {
    const [reassignId, setReassignId] = useState(null)
    const [reassignDepartment, setReassignDepartment] = useState("")
    const [page, setPage] = useState(1)
    const pageCount = Math.max(1, Math.ceil(tickets.length / 10))
    const currentPage = Math.min(page, pageCount)
    const visibleTickets = tickets.slice((currentPage - 1) * 10, currentPage * 10)
    function reassign(event, ticket) {
        event.preventDefault()
        const values = Object.fromEntries(new FormData(event.currentTarget).entries())
        onAction(ticket, "reassign", values)
        setReassignId(null)
    }
    return <section className="sh-panel sh-ticket-panel"><div className="sh-panel-head"><div><h2>Recent tickets</h2><p>Latest requests and their current owners</p></div>{onView && <button className="sh-link" onClick={onView}>View all ↗</button>}</div><div className="sh-table-scroll"><table><thead><tr><th>Ticket</th><th>Subject</th><th>Department</th><th>Assigned to</th><th>Priority</th><th>Status</th><th>Action</th></tr></thead><tbody>{visibleTickets.length ? visibleTickets.map(t => <Fragment key={t.id}><tr><td className="sh-id">#{t.ticket_id}</td><td className="sh-subject">{t.subject}</td><td>{t.department?.dept_name || "—"}</td><td>{t.team_member?.name || "Unassigned"}</td><td><span className={`sh-priority ${(t.priority || "").toLowerCase()}`}>{t.priority}</span></td><td><span className={`sh-status ${(t.status || "").toLowerCase().replace(" ", "-")}`}>{t.status}</span></td><td>{role === "team_member" && t.status === "Open" ? <button className="sh-row-action" onClick={() => onAction(t, "start_work")}>Start work</button> : role === "team_member" && t.status === "In Progress" ? <button className="sh-row-action" onClick={() => onAction(t, "resolve")}>Resolve</button> : role === "tech_admin" && ["Open", "In Progress"].includes(t.status) ? <button className="sh-row-action" onClick={() => { setReassignId(reassignId === t.id ? null : t.id); setReassignDepartment(t.department?.id || "") }}>Reassign</button> : <span>—</span>}</td></tr>{reassignId === t.id && <tr><td colSpan="7"><form className="sh-reassign-form" onSubmit={event => reassign(event, t)}><select name="department" required value={reassignDepartment} onChange={event => { setReassignDepartment(event.target.value); event.target.form.elements.member.value = "" }}>{departments.filter(d => d.is_active).map(d => <option key={d.id} value={d.id}>{d.dept_name}</option>)}</select><select name="member" required defaultValue=""><option value="" disabled>Choose available member</option>{members.filter(m => m.is_active && (m.active_tickets ?? 0) < 5 && m.department?.id === reassignDepartment).map(m => <option key={m.id} value={m.id}>{m.name} · {m.active_tickets ?? 0}/5 active</option>)}</select><button className="sh-row-action" type="submit">Save assignment</button></form></td></tr>}</Fragment>) : <tr><td colSpan="7" className="sh-empty">No tickets found.</td></tr>}</tbody></table></div><Pagination page={currentPage} pageCount={pageCount} total={tickets.length} onChange={setPage} /></section>
}
function Activity({ history, onView }) { return <section className="sh-panel sh-activity"><div className="sh-panel-head"><div><h2>Recent activity</h2><p>Latest ticket updates</p></div><button className="sh-link" onClick={onView}>View all ↗</button></div><div className="sh-activity-list">{history.length ? history.map((h, i) => <div className="sh-activity-item" key={h.id}><span className={`sh-activity-icon a${i % 4}`}>{h.new_status === "Resolved" ? "✓" : "↻"}</span><div><p><b>{h.changed_by_member?.name || h.changed_by_admin?.username || "Support team"}</b> {h.note || `updated ticket #${h.ticket?.ticket_id}`}</p><small>Ticket #{h.ticket?.ticket_id} · {new Date(h.created_at).toLocaleString()}</small></div></div>) : <p className="sh-empty-text">No recent activity yet.</p>}</div></section> }
function HistoryTable({ history }) {
    const [page, setPage] = useState(1)
    const pageCount = Math.max(1, Math.ceil(history.length / 10))
    const currentPage = Math.min(page, pageCount)
    const visibleHistory = history.slice((currentPage - 1) * 10, currentPage * 10)
    return <><div className="sh-table-scroll"><table><thead><tr><th>Ticket</th><th>Update</th><th>Changed by</th><th>Previous status</th><th>New status</th><th>When</th></tr></thead><tbody>{visibleHistory.length ? visibleHistory.map(h => <tr key={h.id}><td className="sh-id">#{h.ticket?.ticket_id}</td><td>{h.note || "Ticket updated"}</td><td>{h.changed_by_member?.name || h.changed_by_admin?.username || "Support team"}</td><td>{h.old_status || "—"}</td><td>{h.new_status || "—"}</td><td>{new Date(h.created_at).toLocaleString()}</td></tr>) : <tr><td colSpan="6" className="sh-empty">No ticket history found.</td></tr>}</tbody></table></div><Pagination page={currentPage} pageCount={pageCount} total={history.length} onChange={setPage} /></>
}
function SimpleTable({ headers, rows }) {
    const [page, setPage] = useState(1)
    const pageCount = Math.max(1, Math.ceil(rows.length / 10))
    const currentPage = Math.min(page, pageCount)
    const pageRows = rows.slice((currentPage - 1) * 10, currentPage * 10)
    return <><div className="sh-table-scroll"><table><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{pageRows.length ? pageRows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length} className="sh-empty">No records found.</td></tr>}</tbody></table></div><Pagination page={currentPage} pageCount={pageCount} total={rows.length} onChange={setPage} /></>
}
function Pagination({ page, pageCount, total, onChange }) {
    if (total <= 10) return null
    return <div className="sh-pagination"><span>Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of {total}</span><div><button disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount} onClick={() => onChange(page + 1)}>Next</button></div></div>
}

function EntryForm({ section, departments, members, profile, fieldErrors = {}, onClearField = () => {}, onSubmit }) {
    const [selectedDepartment, setSelectedDepartment] = useState("")
    const fields = section === "Create ticket" ? [["subject", "Subject"], ["description", "Description", "textarea"], ["department", "Department", "department"], ["member", "Assign to", "member"], ["priority", "Priority", "priority"], ["due_at", "Due date", "date"]]
        : section === "Departments" ? [["dept_name", "Department name"], ["Responsibilities", "Responsibilities", "textarea"]]
            : section === "Tech admins" ? [["username", "Username"], ["name", "Full name"], ["email", "Email", "email"], ["phone", "Phone (10 digits)"], ["password", "Temporary password", "password"], ["branch", "Branch"], ["address", "Address", "textarea"]]
                : section === "Team members" ? [["username", "Username"], ["name", "Full name"], ["email", "Email", "email"], ["phone", "Phone (10 digits)"], ["password", "Temporary password", "password"], ["department", "Department", "department"], ["address", "Address", "textarea"]]
                    : [["name", "Full name"], ["email", "Email", "email"], ["phone", "Phone (10 digits)"], ["password", "New password (optional)", "password"], ["address", "Address", "textarea"], ["profile_photo", "Profile photo", "file"]]
    return <form className="sh-entry-form" noValidate onSubmit={onSubmit}>
        {fields.map(([name, label, type]) => <label className={`sh-field${type === "textarea" ? " sh-field-wide" : ""}${fieldErrors[name] ? " has-error" : ""}`} key={name}>{label}
            {type === "textarea" ? <textarea name={name} required rows="3" aria-invalid={Boolean(fieldErrors[name])} defaultValue={section === "My profile" ? profile?.[name] || "" : undefined} onChange={() => onClearField(name)} /> : type === "department" ? <select name={name} required defaultValue="" aria-invalid={Boolean(fieldErrors[name])} onChange={event => { setSelectedDepartment(event.target.value); onClearField(name); if (section === "Create ticket") event.target.form.elements.member.value = "" }}><option value="" disabled>Select department</option>{departments.filter(d => d.is_active).map(d => <option key={d.id} value={section === "Team members" ? d.dept_name : d.id}>{d.dept_name}</option>)}</select> : type === "member" ? <select name={name} required defaultValue="" aria-invalid={Boolean(fieldErrors[name])} onChange={() => onClearField(name)}><option value="" disabled>Select available member</option>{members.filter(m => m.is_active && (m.active_tickets ?? 0) < 5 && (section !== "Create ticket" || !selectedDepartment || m.department?.id === selectedDepartment)).map(m => <option key={m.id} value={m.id}>{m.name} · {m.department?.dept_name} · {m.active_tickets ?? 0}/5 active</option>)}</select> : type === "priority" ? <select name={name} required defaultValue="Medium" aria-invalid={Boolean(fieldErrors[name])} onChange={() => onClearField(name)}><option>Low</option><option>Medium</option><option>High</option></select> : <input name={name} type={type || "text"} required={name !== "password" && section !== "My profile"} aria-invalid={Boolean(fieldErrors[name])} defaultValue={section === "My profile" && name !== "profile_photo" ? profile?.[name] || "" : undefined} accept={type === "file" ? "image/png,image/jpeg,image/webp" : undefined} onChange={() => onClearField(name)} />}
            {fieldErrors[name] && <span className="sh-field-error">{fieldErrors[name]}</span>}
        </label>)}
        {section === "My profile" && <p className="sh-form-help">Leave any field blank to keep the current value. Passwords must include uppercase and lowercase letters, a number, and a special character.</p>}
        <div className="sh-form-actions"><button className="sh-primary" type="submit">{section === "My profile" ? "Save profile" : section === "Create ticket" ? "Create ticket" : `Create ${section === "Departments" ? "department" : section === "Tech admins" ? "tech admin" : "team member"}`}</button></div>
    </form>
}

export default SupportDashboard

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "react-toastify"
import { apiFetch } from "../api"
import logo from "../assets/logo.png"
import "./support-dashboard.css"

const roleLabels = { super_admin: "Super Admin", tech_admin: "Tech Admin", team_member: "Team Member" }
const menus = {
    super_admin: ["Dashboard", "Departments", "Tech admins", "Team members", "All tickets", "Ticket history"],
    tech_admin: ["Dashboard", "All tickets", "Team members", "Departments", "Ticket history"],
    team_member: ["Dashboard", "My tickets", "Ticket history"]
}


function NavIcon({ name }) {
    const icon = {
        Dashboard: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></>,
        Departments: <><path d="M4 20.5h16M6 20.5V8l6-4 6 4v12.5M9 10h.01M15 10h.01M9 13.5h.01M15 13.5h.01M10 20.5v-4h4v4"/></>,
        "Tech admins": <><circle cx="9" cy="8" r="3.5"/><path d="M3 20c.4-3.2 2.4-5 6-5 1.5 0 2.7.3 3.6.9M16 11l1.8 1.8L21 9.5M15 16.5l2 1 2-1 .5 2.3-1.5 1.7-1-.3-1 .3-1.5-1.7z"/></>,
        "Team members": <><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.4-3.2 2.2-4.8 5.5-4.8s5.1 1.6 5.5 4.8M16 5.5a3 3 0 0 1 0 5.8M17 15.5c2.2.6 3.4 2.1 3.7 4.5"/></>,
        "All tickets": <><path d="M6 3.5h8l4 4v13H6zM14 3.5v4h4M9 12h6M9 16h6"/><path d="M4 6v15"/></>,
        "My tickets": <><path d="M5 4h14v4a2.5 2.5 0 0 0 0 5v4H5v-4a2.5 2.5 0 0 0 0-5zM12 7v2M12 12v2"/></>,
        "Create ticket": <><circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/></>,
        "Ticket history": <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2M4 7V3.5M4 7h3.5"/></>,
        "Log out": <><path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10"/></>
    }[name]

    return <svg className="sh-nav-svg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
}

function TicketActionIcon({ name }) {
    const icon = {
        start: <path d="m8 5 11 7-11 7z" fill="currentColor" stroke="none" />,
        resolve: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16.5 9"/></>,
        reject: <><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></>,
        close: <><path d="M4 8h16v12H4zM3 5h18v3H3z"/><path d="m9 14 2 2 4-4"/></>,
        edit: <><path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5z"/><path d="m13.8 6.7 3.5 3.5"/></>,
        reassign: <><path d="M4 7h13l-3-3m6 13H7l3 3"/><path d="M17 4l3 3-3 3M7 14l-3 3 3 3"/></>,
        delete: <><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/></>
    }[name]

    return <svg className="sh-action-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
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
    const [section, setSection] = useState("Dashboard")
    const [tickets, setTickets] = useState([])
    const [history, setHistory] = useState([])
    const [departments, setDepartments] = useState([])
    const [members, setMembers] = useState([])
    const [admins, setAdmins] = useState([])
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [query, setQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState([])
    const [departmentFilter, setDepartmentFilter] = useState([])
    const [priorityFilter, setPriorityFilter] = useState([])
    const [openFilter, setOpenFilter] = useState("")
    const [fieldErrors, setFieldErrors] = useState({})
    const [formOpen, setFormOpen] = useState(false)
    const [createMenuOpen, setCreateMenuOpen] = useState(false)
    const [profileMenuOpen, setProfileMenuOpen] = useState(false)
    const [profileEditOpen, setProfileEditOpen] = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

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

    useEffect(() => {
        if (section !== "Dashboard") return
        const collapseOnScroll = () => {
            if (window.matchMedia("(min-width: 801px)").matches && window.scrollY > 4) {
                setSidebarCollapsed(true)
            }
        }
        window.addEventListener("scroll", collapseOnScroll, { passive: true })
        return () => window.removeEventListener("scroll", collapseOnScroll)
    }, [section])

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
    const filtered = myTickets.filter(t =>
        `${t.ticket_id} ${t.subject} ${t.department?.dept_name} ${t.team_member?.name} ${t.status}`.toLowerCase().includes(query.toLowerCase()) &&
        (!statusFilter.length || statusFilter.includes(t.status)) &&
        (!departmentFilter.length || departmentFilter.includes(String(t.department?.id || ""))) &&
        (!priorityFilter.length || (t.status !== "Closed" && priorityFilter.includes(t.priority)))
    )
    const title = section
    const canOpenForm = (section === "Create ticket" && role === "tech_admin") ||
        (section === "Team members" && role === "tech_admin") ||
        (role === "super_admin" && ["Departments", "Tech admins"].includes(section))

    async function updateTicket(ticket, operation, details = {}) {
        try {
            const response = operation === "delete_ticket"
                ? await apiFetch(`ticket/${ticket.ticket_id}`, { method: "DELETE" })
                : await apiFetch("ticket", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket_id: String(ticket.ticket_id), [operation]: true, ...details }) })
            const data = await response.json()
            if (!response.ok) throw new Error(data.message || "Could not update ticket")
            if (operation === "delete_ticket") toast.success("Ticket deleted successfully.")
            await load()
            return true
        } catch (e) { toast.error(e.message); return false }
    }

    async function updateEntityStatus(resource, record) {
        const activate = !record.is_active
        try {
            const response = await apiFetch(`${resource}/${activate ? "activate" : "deactivate"}/${record.id}`, { method: "PATCH" })
            const result = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(result.message || `Could not ${activate ? "activate" : "deactivate"} record`)
            toast.success(result.message || `${record.name || record.dept_name} ${activate ? "activated" : "deactivated"} successfully.`)
            await load()
            return true
        } catch (error) {
            toast.error(error.message)
            return false
        }
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
    function toggleSidebar() {
        if (window.matchMedia("(max-width: 800px)").matches) setMobileSidebarOpen(open => !open)
        else setSidebarCollapsed(collapsed => !collapsed)
    }
    function selectSection(nextSection) {
        setSection(nextSection)
        setFormOpen(nextSection === "Create ticket")
    }

    const recent = [...tickets].slice(0, 6)
    const rows = section === "My tickets" ? filtered : filtered

    return <div className={`sh-app${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
        <aside id="support-sidebar" className={`sh-sidebar${sidebarCollapsed ? " collapsed" : ""}${mobileSidebarOpen ? " show" : ""}`}>
            <nav>{menus[role].map(name => <button key={name} className={section === name ? "active" : ""} title={sidebarCollapsed ? name : undefined} onClick={() => { selectSection(name); setMobileSidebarOpen(false) }}><span className="sh-nav-icon"><NavIcon name={name} /></span><span className="sh-nav-text">{name}</span></button>)}</nav>
            <button className="sh-logout" onClick={logout}><span className="sh-nav-icon"><NavIcon name="Log out" /></span><span className="sh-nav-text">Log out</span></button>
        </aside>
        <main className={`sh-main${sidebarCollapsed ? " sh-main-collapsed" : ""}`}>
            <header className="sh-topbar"><button className="sh-mobile-menu" aria-label={window.matchMedia("(max-width: 800px)").matches ? (mobileSidebarOpen ? "Close navigation" : "Open navigation") : (sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar")} aria-controls="support-sidebar" aria-expanded={window.matchMedia("(max-width: 800px)").matches ? mobileSidebarOpen : !sidebarCollapsed} onClick={toggleSidebar}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg></button><div className="sh-crumb">{title}</div><div className="sh-account">{role === "super_admin" ? <div className="sh-account-identity"><span className="sh-avatar">SA</span><span className="sh-account-name">Admin<small>Super Admin</small></span></div> : <><button className="sh-profile-trigger" aria-haspopup="dialog" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen(value => !value)}><span className="sh-avatar">{profile?.profile_photo_data_url ? <img src={profile.profile_photo_data_url} alt="" /> : (profile?.name || profile?.username || roleLabels[role])[0]}</span><span className="sh-account-name">{profile?.name || profile?.username || roleLabels[role]}<small>{roleLabels[role]}</small></span><span className="sh-caret">⌄</span></button>{profileMenuOpen && <div className="sh-profile-menu" role="dialog" aria-label="Your profile"><div className="sh-profile-menu-heading"><b>{profile?.name || profile?.username || roleLabels[role]}</b><span>{roleLabels[role]}</span></div><dl><dt>Email</dt><dd>{profile?.email || "Not added"}</dd><dt>Phone</dt><dd>{profile?.phone || "Not added"}</dd>{profile?.department?.dept_name && <><dt>Department</dt><dd>{profile.department.dept_name}</dd></>}</dl><button className="sh-primary" onClick={() => { setProfileMenuOpen(false); setProfileEditOpen(true) }}>Edit profile</button></div>}</>}</div></header>
            <div className="sh-content">
                {section === "Dashboard" && <><div className="sh-welcome"><div><p className="sh-eyebrow">SUPPORTHUB WORKSPACE</p><h1>Welcome, {profile?.name || profile?.username || roleLabels[role]}<span>!</span></h1><p className="sh-subtitle">A clear view of the support work that needs your attention.</p></div>{role === "tech_admin" && <div className="sh-welcome-actions"><button className="sh-primary sh-secondary-action" onClick={() => selectSection("Create ticket")}><span aria-hidden="true">＋</span> Create ticket</button><button className="sh-primary sh-secondary-action" onClick={() => { setSection("Team members"); setFormOpen(true) }}><span aria-hidden="true">＋</span> Create team member</button></div>}{role === "super_admin" && <div className="sh-welcome-actions"><button className="sh-primary" aria-haspopup="menu" aria-expanded={createMenuOpen} onClick={() => setCreateMenuOpen(open => !open)}>＋ Create <span aria-hidden="true">⌄</span></button>{createMenuOpen && <div className="sh-create-menu" role="menu"><button role="menuitem" onClick={() => { setCreateMenuOpen(false); setSection("Departments"); setFormOpen(true) }}>Department</button><button role="menuitem" onClick={() => { setCreateMenuOpen(false); setSection("Tech admins"); setFormOpen(true) }}>Tech Admin</button></div>}</div>}</div>
                    <div className="sh-stat-grid">{(role === "super_admin" ? [["Total tickets", counts.total, "▤", "blue"], ["Departments", departments.length, "▥", "orange"], ["Tech admins", admins.length, "♙", "purple"], ["Team members", members.length, "♧", "green"]] : role === "tech_admin" ? [["Total tickets", counts.total, "▤", "blue"], ["Open tickets", counts.open, "▱", "orange"], ["In progress", counts.progress, "◌", "purple"], ["Resolved", counts.resolved, "✓", "green"]] : [["My tickets", counts.total, "▤", "blue"], ["Open", counts.open, "▱", "orange"], ["In progress", counts.progress, "◌", "purple"], ["Resolved", counts.resolved, "✓", "green"]]).concat([["Avg. resolution", averageResolutionTime(myTickets), "◷", "purple"]]).map(([label, value, icon, color]) => <article className="sh-stat" key={label}><span className={`sh-stat-icon ${color}`}>{icon}</span><div><span>{label}</span><strong>{value}</strong><small>{label === "Avg. resolution" ? "Resolved tickets" : "Current workload"}</small></div></article>)}</div>
                    <div className="sh-panels"><section className="sh-panel sh-wide"><div className="sh-panel-head"><div><h2>Ticket status updates</h2><p>Monthly status changes from ticket history</p></div><button className="sh-link" onClick={() => selectSection(role === "team_member" ? "My tickets" : "All tickets")}>View tickets ↗</button></div><div className="sh-chart"><div className="sh-chart-labels"><span>{monthlyActivity.max}</span><span>{Math.round(monthlyActivity.max * 2 / 3)}</span><span>{Math.round(monthlyActivity.max / 3)}</span><span>0</span></div><div className="sh-chart-area"><div className="sh-grid-lines"><i/><i/><i/><i/></div><svg viewBox="0 0 700 170" preserveAspectRatio="none" aria-label="Monthly ticket status updates"><polyline points={monthlyActivity.open}/><polyline className="line-purple" points={monthlyActivity.progress}/><polyline className="line-green" points={monthlyActivity.resolved}/></svg><div className="sh-months">{monthlyActivity.months.map(month => <span key={month.key}>{month.label}</span>)}</div></div></div><div className="sh-legend"><span><i className="blue-dot"/>Opened</span><span><i className="purple-dot"/>In progress</span><span><i className="green-dot"/>Resolved/closed</span></div></section>
                        <section className="sh-panel sh-breakdown"><div className="sh-panel-head"><div><h2>Tickets by status</h2><p>Current distribution</p></div></div><div className="sh-donut-wrap"><div className="sh-donut" style={{ background: statusDonut(counts) }}><div><strong>{counts.total}</strong><span>Tickets</span></div></div><div className="sh-donut-legend"><span><i className="blue-dot"/>Open <b>{counts.open}</b></span><span><i className="purple-dot"/>In progress <b>{counts.progress}</b></span><span><i className="green-dot"/>Resolved <b>{counts.resolved}</b></span></div></div></section>
                    </div>
                    <div className="sh-panels sh-lower"><TicketTable tickets={recent} role={role} currentUserId={profile?.id} members={members} departments={departments} onAction={updateTicket} onView={() => selectSection(role === "team_member" ? "My tickets" : "All tickets")} /><Activity history={history.slice(0, 5)} onView={() => selectSection("Ticket history")} /></div>
                </>}
                {section !== "Dashboard" && <section className="sh-panel sh-list-panel"><div className="sh-panel-head"><div><p className="sh-eyebrow">MANAGE YOUR WORK</p><h2>{section}</h2><p>Live information from your SupportHub workspace.</p></div>{canOpenForm && <button className="sh-primary" onClick={() => setFormOpen(!formOpen)}>{formOpen ? "Close form" : section === "My profile" ? "Edit my profile" : `＋ ${section === "Create ticket" ? "New ticket" : section === "Departments" ? "New department" : section === "Tech admins" ? "New tech admin" : "New team member"}`}</button>}</div>
                    {formOpen && <div className="sh-modal-backdrop" onClick={() => setFormOpen(false)}><section className="sh-form-modal" role="dialog" aria-modal="true" aria-labelledby="sh-form-title" onClick={event => event.stopPropagation()}><div className="sh-modal-head"><span className="sh-modal-mark">{section === "My profile" ? "♙" : section === "Create ticket" ? "＋" : section === "Departments" ? "▥" : section === "Tech admins" ? "♙" : "♧"}</span><div><p className="sh-eyebrow">SUPPORTHUB WORKSPACE</p><h3 id="sh-form-title">{section === "My profile" ? "Update your profile" : section === "Create ticket" ? "Create a ticket" : `Create ${section === "Departments" ? "a department" : section === "Tech admins" ? "a tech admin" : "a team member"}`}</h3><p>{section === "My profile" ? "Your account details are yours to manage." : section === "Create ticket" ? "Add the request details and assign it to an available teammate." : "Enter the details below to add this to your workspace."}</p></div><button className="sh-modal-close" type="button" aria-label="Close form" onClick={() => setFormOpen(false)}>×</button></div><EntryForm section={section} departments={departments} members={members} profile={profile} fieldErrors={fieldErrors} onClearField={name => setFieldErrors(errors => ({ ...errors, [name]: undefined }))} onSubmit={submitForm} /></section></div>}
                    {!formOpen && (section === "Ticket history" ? <HistoryTable history={history} /> : section === "Departments" ? <SimpleTable headers={["Department", "Responsibilities", "Active members", "Status"]} rows={departments.map(d => [d.dept_name, d.Responsibilities || "—", members.filter(m => m.is_active && m.department?.id === d.id).length, d.is_active ? "Active" : "Inactive"])} records={departments} resource="department" onToggle={updateEntityStatus} /> : section === "Tech admins" ? <SimpleTable headers={["Name", "Username", "Branch", "Team members", "Status"]} rows={admins.map(a => [a.name, a.username, a.branch, a.team_member_count ?? 0, a.is_active ? "Active" : "Inactive"])} records={admins} resource="tech_admin" onToggle={updateEntityStatus} /> : section === "Team members" ? <SimpleTable headers={["Name", "Username", "Department", "Status", "Active tickets"]} rows={members.map(m => [m.name, m.username, m.department?.dept_name || "—", m.is_active ? "Active" : "Inactive", m.active_tickets ?? "—"])} records={members} resource="team_member" onToggle={updateEntityStatus} /> : section === "Create ticket" ? null : <><div className="sh-toolbar"><div className="sh-toolbar-controls"><label className="sh-search">⌕<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tickets..." /></label>{section === "All tickets" && <div className="sh-ticket-filters"><CheckboxFilter label="Status" options={["Open", "In Progress", "Resolved", "Closed", "Rejected"].map(value => ({ value, label: value }))} values={statusFilter} onChange={setStatusFilter} open={openFilter === "Status"} onToggle={() => setOpenFilter(current => current === "Status" ? "" : "Status")} /><CheckboxFilter label="Department" options={departments.map(item => ({ value: String(item.id), label: item.dept_name }))} values={departmentFilter} onChange={setDepartmentFilter} open={openFilter === "Department"} onToggle={() => setOpenFilter(current => current === "Department" ? "" : "Department")} /><CheckboxFilter label="Priority" options={["High", "Medium", "Low"].map(value => ({ value, label: value }))} values={priorityFilter} onChange={setPriorityFilter} open={openFilter === "Priority"} onToggle={() => setOpenFilter(current => current === "Priority" ? "" : "Priority")} />{(statusFilter.length || departmentFilter.length || priorityFilter.length) > 0 && <button type="button" className="sh-clear-filters" onClick={() => { setStatusFilter([]); setDepartmentFilter([]); setPriorityFilter([]) }}>Clear filters</button>}</div>}</div><span>{filtered.length} tickets</span></div><TicketTable tickets={rows} role={role} currentUserId={profile?.id} members={members} departments={departments} onAction={updateTicket} /></>)}
                </section>}
                    {profileEditOpen && <div className="sh-modal-backdrop" onClick={() => setProfileEditOpen(false)}><section className="sh-form-modal" role="dialog" aria-modal="true" aria-labelledby="sh-profile-title" onClick={event => event.stopPropagation()}><div className="sh-modal-head"><span className="sh-modal-mark">♙</span><div><p className="sh-eyebrow">YOUR ACCOUNT</p><h3 id="sh-profile-title">Edit your profile</h3><p>Update your personal details and profile photo.</p></div><button className="sh-modal-close" type="button" aria-label="Close profile editor" onClick={() => setProfileEditOpen(false)}>×</button></div><EntryForm section="My profile" departments={departments} members={members} profile={profile} fieldErrors={fieldErrors} onClearField={name => setFieldErrors(errors => ({ ...errors, [name]: undefined }))} onSubmit={event => submitForm(event, "My profile")} /></section></div>}
                    {loading && <div className="sh-loading"><span className="sh-spinner"/>Loading workspace…</div>}
            </div>
        </main>
    </div>
}

function TicketTable({ tickets, role, currentUserId, members = [], departments = [], onAction, onView }) {
    const [reassignId, setReassignId] = useState(null)
    const [editTicketId, setEditTicketId] = useState(null)
    const [ticketToDelete, setTicketToDelete] = useState(null)
    const [isDeleting, setIsDeleting] = useState(false)
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
    function saveEdit(event, ticket) {
        event.preventDefault()
        const values = Object.fromEntries(new FormData(event.currentTarget).entries())
        onAction(ticket, "edit_details", values)
        setEditTicketId(null)
    }

    function requestDelete(ticket) {
        if (ticket.status !== "Open") {
            toast.error("Only open tickets can be deleted.")
            return
        }
        setTicketToDelete(ticket)
    }

    async function confirmDelete() {
        if (!ticketToDelete || isDeleting) return
        setIsDeleting(true)
        const deleted = await onAction(ticketToDelete, "delete_ticket")
        setIsDeleting(false)
        if (deleted) setTicketToDelete(null)
    }

    return <><section className="sh-panel sh-ticket-panel">
        <div className="sh-panel-head"><div><h2>Recent tickets</h2><p>Latest requests and their current owners</p></div>{onView && <button className="sh-link" onClick={onView}>View all ↗</button>}</div>
        <div className="sh-table-scroll"><table>
            <thead><tr><th>Ticket</th><th>Subject</th><th>Department</th><th>Assigned to</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{visibleTickets.length ? visibleTickets.map(ticket => <Fragment key={ticket.id}>
                <tr>
                    <td className="sh-id">#{ticket.ticket_id}</td><td className="sh-subject">{ticket.subject}</td><td>{ticket.department?.dept_name || "—"}</td><td>{ticket.team_member?.name || "Unassigned"}</td>
                    <td><span className={`sh-priority ${(ticket.priority || "").toLowerCase()}`}>{ticket.priority}</span></td>
                    <td><span className={`sh-status ${(ticket.status || "").toLowerCase().replace(" ", "-")}`}>{ticket.status}</span></td>
                    <td>
                        {role === "team_member" && ticket.status === "Open" ? <div className="sh-ticket-actions"><button type="button" className="sh-row-action sh-icon-action" aria-label="Start work" title="Start work" onClick={() => onAction(ticket, "start_work")}><TicketActionIcon name="start"/></button><button type="button" className="sh-row-action sh-icon-action sh-reject-action" aria-label="Reject ticket" title="Reject ticket" onClick={() => onAction(ticket, "reject")}><TicketActionIcon name="reject"/></button></div>
                            : role === "team_member" && ticket.status === "In Progress" ? <div className="sh-ticket-actions"><button type="button" className="sh-row-action sh-icon-action" aria-label="Resolve ticket" title="Resolve ticket" onClick={() => onAction(ticket, "resolve")}><TicketActionIcon name="resolve"/></button><button type="button" className="sh-row-action sh-icon-action sh-reject-action" aria-label="Reject ticket" title="Reject ticket" onClick={() => onAction(ticket, "reject")}><TicketActionIcon name="reject"/></button></div>
                                : ["tech_admin", "super_admin"].includes(role) ? <div className="sh-ticket-actions">
                                    {role === "tech_admin" && ticket.status === "Resolved" && <button type="button" className="sh-row-action sh-icon-action" aria-label="Close ticket" title="Close ticket" onClick={() => onAction(ticket, "close")}><TicketActionIcon name="close"/></button>}
                                    {role === "tech_admin" && ["Open", "In Progress", "Rejected"].includes(ticket.status) && <><button type="button" className="sh-row-action sh-icon-action sh-edit-action" aria-label="Edit ticket details" title="Edit ticket details" onClick={() => { setEditTicketId(editTicketId === ticket.id ? null : ticket.id); setReassignId(null) }}><TicketActionIcon name="edit"/></button><button type="button" className="sh-row-action sh-icon-action" aria-label="Reassign ticket" title="Reassign ticket" onClick={() => { setReassignId(reassignId === ticket.id ? null : ticket.id); setEditTicketId(null); setReassignDepartment(ticket.department?.id || "") }}><TicketActionIcon name="reassign"/></button></>}
                                    {role === "tech_admin" && ticket.tech_admin?.id === currentUserId && <button type="button" className="sh-row-action sh-icon-action sh-delete-action" aria-label="Delete ticket" title="Delete ticket (Open tickets only)" onClick={() => requestDelete(ticket)}><TicketActionIcon name="delete"/></button>}
                                </div>
                                        : <span>—</span>}
                    </td>
                </tr>
                {editTicketId === ticket.id && <tr><td colSpan="7">
                    <form className="sh-ticket-edit-form" onSubmit={event => saveEdit(event, ticket)}>
                        <label>Subject<input name="subject" required defaultValue={ticket.subject} /></label>
                        <label>Description<textarea name="description" required rows="2" defaultValue={ticket.description} /></label>
                        <label>Priority<select name="priority" required defaultValue={ticket.priority}><option>Low</option><option>Medium</option><option>High</option></select></label>
                        <label>Due date<input name="due_at" type="date" required defaultValue={ticket.due_at?.slice(0, 10) || ""} /></label>
                        <div className="sh-edit-actions"><button className="sh-row-action" type="submit">Save changes</button><button className="sh-row-action sh-cancel-action" type="button" onClick={() => setEditTicketId(null)}>Cancel</button></div>
                    </form>
                </td></tr>}
                {reassignId === ticket.id && <tr><td colSpan="7"><form className="sh-reassign-form" onSubmit={event => reassign(event, ticket)}>
                    <select name="department" required value={reassignDepartment} onChange={event => { setReassignDepartment(event.target.value); event.target.form.elements.member.value = "" }}>{departments.filter(department => department.is_active).map(department => <option key={department.id} value={department.id}>{department.dept_name}</option>)}</select>
                    <select name="member" required defaultValue=""><option value="" disabled>Choose available member</option>{members.filter(member => member.is_active && (member.active_tickets ?? 0) < 5 && member.department?.id === reassignDepartment).map(member => <option key={member.id} value={member.id}>{member.name} · {member.active_tickets ?? 0}/5 active</option>)}</select>
                    <button className="sh-row-action" type="submit">Save assignment</button>
                </form></td></tr>}
            </Fragment>) : <tr><td colSpan="7" className="sh-empty">No tickets found.</td></tr>}</tbody>
        </table></div>
        <Pagination page={currentPage} pageCount={pageCount} total={tickets.length} onChange={setPage} />
    </section>
    {ticketToDelete && <div className="sh-modal-backdrop sh-delete-backdrop" onClick={() => !isDeleting && setTicketToDelete(null)}>
        <section className="sh-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="sh-delete-title" onClick={event => event.stopPropagation()}>
            <span className="sh-confirm-icon"><TicketActionIcon name="delete"/></span>
            <p className="sh-eyebrow">DELETE TICKET</p>
            <h3 id="sh-delete-title">Delete ticket #{ticketToDelete.ticket_id}?</h3>
            <p>This open ticket will be removed from the workspace, and its team member’s active ticket slot will be freed.</p>
            <div className="sh-confirm-actions">
                <button type="button" className="sh-cancel-action" disabled={isDeleting} onClick={() => setTicketToDelete(null)}>Cancel</button>
                <button type="button" className="sh-confirm-delete" disabled={isDeleting} onClick={confirmDelete}>{isDeleting ? "Deleting…" : "Delete ticket"}</button>
            </div>
        </section>
    </div>}
    </>
}
function Activity({ history, onView }) { return <section className="sh-panel sh-activity"><div className="sh-panel-head"><div><h2>Recent activity</h2><p>Latest ticket updates</p></div><button className="sh-link" onClick={onView}>View all ↗</button></div><div className="sh-activity-list">{history.length ? history.map((h, i) => <div className="sh-activity-item" key={h.id}><span className={`sh-activity-icon a${i % 4}`}>{h.new_status === "Resolved" ? "✓" : "↻"}</span><div><p><b>{h.changed_by_member?.name || h.changed_by_admin?.username || "Support team"}</b> {h.note || `updated ticket #${h.ticket?.ticket_id}`}</p><small>Ticket #{h.ticket?.ticket_id} · {new Date(h.created_at).toLocaleString()}</small></div></div>) : <p className="sh-empty-text">No recent activity yet.</p>}</div></section> }
function HistoryTable({ history }) {
    const [page, setPage] = useState(1)
    const pageCount = Math.max(1, Math.ceil(history.length / 10))
    const currentPage = Math.min(page, pageCount)
    const visibleHistory = history.slice((currentPage - 1) * 10, currentPage * 10)
    return <><div className="sh-table-scroll"><table><thead><tr><th>Ticket</th><th>Update</th><th>Changed by</th><th>Previous status</th><th>New status</th><th>When</th></tr></thead><tbody>{visibleHistory.length ? visibleHistory.map(h => <tr key={h.id}><td className="sh-id">#{h.ticket?.ticket_id}</td><td>{h.note || "Ticket updated"}</td><td>{h.changed_by_member?.name || h.changed_by_admin?.username || "Support team"}</td><td>{h.old_status || "—"}</td><td>{h.new_status || "—"}</td><td>{new Date(h.created_at).toLocaleString()}</td></tr>) : <tr><td colSpan="6" className="sh-empty">No ticket history found.</td></tr>}</tbody></table></div><Pagination page={currentPage} pageCount={pageCount} total={history.length} onChange={setPage} /></>
}
function CheckboxFilter({ label, options, values, onChange, open, onToggle }) {
    return <details className="sh-checkbox-filter" open={open}><summary onClick={event => { event.preventDefault(); onToggle() }}>{label}{values.length > 0 && <span>{values.length}</span>}</summary><div className="sh-checkbox-options">{options.length ? options.map(option => <label key={option.value}><input type="checkbox" checked={values.includes(option.value)} onChange={event => onChange(current => event.target.checked ? [...current, option.value] : current.filter(value => value !== option.value))}/><span>{option.label}</span></label>) : <p>No options available</p>}</div></details>
}

function SimpleTable({ headers, rows, records = [], resource, onToggle }) {
    const [page, setPage] = useState(1)
    const [pendingRecord, setPendingRecord] = useState(null)
    const [savingStatus, setSavingStatus] = useState(false)
    const pageCount = Math.max(1, Math.ceil(rows.length / 10))
    const currentPage = Math.min(page, pageCount)
    const startIndex = (currentPage - 1) * 10
    const pageRows = rows.slice(startIndex, startIndex + 10)
    const pageRecords = records.slice(startIndex, startIndex + 10)
    async function confirmStatusChange() {
        if (!pendingRecord || savingStatus) return
        setSavingStatus(true)
        const updated = await onToggle(resource, pendingRecord)
        setSavingStatus(false)
        if (updated) setPendingRecord(null)
    }
    const entityLabel = resource === "department" ? "department" : resource === "tech_admin" ? "tech admin" : "team member"
    return <><div className="sh-table-scroll"><table><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}{onToggle && <th className="sh-management-action-heading">Actions</th>}</tr></thead><tbody>{pageRows.length ? pageRows.map((row, i) => { const record = pageRecords[i]; return <tr key={record?.id ?? i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}{onToggle && <td className="sh-management-action-cell"><button type="button" className={`sh-icon-action sh-management-toggle${record?.is_active ? " sh-delete-action" : " sh-activate-action"}`} aria-label={`${record?.is_active ? "Deactivate" : "Activate"} ${entityLabel}`} title={`${record?.is_active ? "Deactivate" : "Activate"} ${entityLabel}`} onClick={() => setPendingRecord(record)}>{record?.is_active ? <TicketActionIcon name="delete"/> : <TicketActionIcon name="resolve"/>}</button></td>}</tr> }) : <tr><td colSpan={headers.length + (onToggle ? 1 : 0)} className="sh-empty">No records found.</td></tr>}</tbody></table></div><Pagination page={currentPage} pageCount={pageCount} total={rows.length} onChange={setPage} />
        {pendingRecord && <div className="sh-modal-backdrop sh-delete-backdrop" onClick={() => !savingStatus && setPendingRecord(null)}><section className="sh-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="sh-entity-status-title" onClick={event => event.stopPropagation()}><span className={`sh-confirm-icon${pendingRecord.is_active ? "" : " sh-confirm-activate-icon"}`}><TicketActionIcon name={pendingRecord.is_active ? "delete" : "resolve"}/></span><p className={`sh-eyebrow${pendingRecord.is_active ? "" : " sh-activate-eyebrow"}`}>{pendingRecord.is_active ? `DEACTIVATE ${entityLabel.toUpperCase()}` : `ACTIVATE ${entityLabel.toUpperCase()}`}</p><h3 id="sh-entity-status-title">{pendingRecord.is_active ? "Deactivate" : "Activate"} {pendingRecord.name || pendingRecord.dept_name}?</h3><p>{pendingRecord.is_active ? `This will deactivate the ${entityLabel}. It can be activated again later.` : `This will restore the ${entityLabel}'s access to SupportHub.`}</p><div className="sh-confirm-actions"><button type="button" className="sh-cancel-action" disabled={savingStatus} onClick={() => setPendingRecord(null)}>Cancel</button><button type="button" className={pendingRecord.is_active ? "sh-confirm-delete" : "sh-confirm-activate"} disabled={savingStatus} onClick={confirmStatusChange}>{savingStatus ? `${pendingRecord.is_active ? "Deactivating" : "Activating"}…` : `${pendingRecord.is_active ? "Deactivate" : "Activate"} ${entityLabel}`}</button></div></section></div>}
    </>
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
            {type === "textarea" ? <textarea name={name} required rows="3" aria-invalid={Boolean(fieldErrors[name])} defaultValue={section === "My profile" ? profile?.[name] || "" : undefined} onChange={() => onClearField(name)} /> : type === "department" ? <select name={name} required defaultValue="" aria-invalid={Boolean(fieldErrors[name])} onChange={event => { setSelectedDepartment(event.target.value); onClearField(name); if (section === "Create ticket") event.target.form.elements.member.value = "" }}><option value="" disabled>Select department</option>{departments.filter(d => d.is_active).map(d => <option key={d.id} value={section === "Team members" ? d.dept_name : d.id}>{d.dept_name}</option>)}</select> : type === "member" ? <select name={name} required defaultValue="" aria-invalid={Boolean(fieldErrors[name])} onChange={() => onClearField(name)}><option value="" disabled>{section === "Create ticket" && !selectedDepartment ? "Select a department first" : "Select available member"}</option>{members.filter(m => m.is_active && (m.active_tickets ?? 0) < 5 && (section !== "Create ticket" || (selectedDepartment && m.department?.id === selectedDepartment))).map(m => <option key={m.id} value={m.id}>{m.name} · {m.department?.dept_name} · {m.active_tickets ?? 0}/5 active</option>)}</select> : type === "priority" ? <select name={name} required defaultValue="Medium" aria-invalid={Boolean(fieldErrors[name])} onChange={() => onClearField(name)}><option>Low</option><option>Medium</option><option>High</option></select> : <input name={name} type={type || "text"} required={name !== "password" && section !== "My profile"} aria-invalid={Boolean(fieldErrors[name])} defaultValue={section === "My profile" && name !== "profile_photo" ? profile?.[name] || "" : undefined} accept={type === "file" ? "image/png,image/jpeg,image/webp" : undefined} onChange={() => onClearField(name)} />}
            {fieldErrors[name] && <span className="sh-field-error">{fieldErrors[name]}</span>}
        </label>)}
        {section === "My profile" && <p className="sh-form-help">Leave any field blank to keep the current value. Passwords must include uppercase and lowercase letters, a number, and a special character.</p>}
        <div className="sh-form-actions"><button className="sh-primary" type="submit">{section === "My profile" ? "Save profile" : section === "Create ticket" ? "Create ticket" : `Create ${section === "Departments" ? "department" : section === "Tech admins" ? "tech admin" : "team member"}`}</button></div>
    </form>
}

export default SupportDashboard

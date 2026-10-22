const { Tech_AdminRepository } = require('../repositories/tech_admin.repository')
const { DepartmentRepository } = require('../repositories/department.repository')
const { AppDataSource } = require('../config/database')
const {TicketRepository}=require('../repositories/ticket.repository')
const {Team_MemberRepository}=require('../repositories/team_member.repository')
const {Team_Member}=require('../entities/team_member.entity')
const {Ticket}=require('../entities/ticket.entity')
const {Ticket_History}=require('../entities/ticket_history.entity')
const {Notification}=require('../entities/notification.entity')

const ALLOWED_PRIORITIES = ['Low', 'Medium', 'High']
const ACTIVE_TICKET_STATUSES = ['Open', 'In Progress']  

function isValidFutureDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const selectedDate = new Date(`${value}T00:00:00.000Z`)
    if (Number.isNaN(selectedDate.getTime()) || selectedDate.toISOString().slice(0, 10) !== value) return false
    const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date())
    return value > today
}

const Create_Ticket = async (req, res) => {
    try {
        const { subject, description, department, member, priority, due_at } = req.body
        const tech_admin_id = req.user.userId

        if (typeof subject !== 'string' || 
            typeof description !== 'string' ||
            typeof department !== 'string' || 
            typeof member !== 'string' ||
            typeof priority !== 'string' || 
            typeof due_at !== 'string'
        ) {
            return res.status(400).json({ message: 'All fields are required' })
        }

        if (!subject.trim()){
            return res.status(400).json({ message: 'Enter Subject' })
        }
        if (!description.trim()) {
            return res.status(400).json({ message: 'Enter Description' })
        }
        if (!department.trim()){
            return res.status(400).json({ message: 'Select Department' })
        }
        if (!member.trim()) {
            return res.status(400).json({ message: 'Select Member' })
        }
        if (!ALLOWED_PRIORITIES.includes(priority)) {
            return res.status(400).json({ message: 'Select a valid Priority' })
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(due_at)) {
            return res.status(400).json({
                message: 'Select a valid Due Date'
            })
        }

        const selectedDate = new Date(`${due_at}T00:00:00.000Z`)

        if (Number.isNaN(selectedDate.getTime()) || selectedDate.toISOString().slice(0, 10) !== due_at ) {
            return res.status(400).json({message: 'Select a valid Due Date'})
        }

        const today = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date())

        if (due_at <= today) {
            return res.status(400).json({message: 'Due Date must be in the future'})
        }

        const dept = await DepartmentRepository.findOneBy({ id: department, is_active: true })

        if (!dept) {
            return res.status(400).json({ message: 'Invalid or inactive department' })
        }

        const tech_admin = await Tech_AdminRepository.findOneBy({ id: tech_admin_id, is_active: true })

        if (!tech_admin) {
            return res.status(403).json({ message: 'Active Tech Admin not found' })
        }

        const savedTicket = await AppDataSource.transaction(async (manager) => {

            const teamMemberRepo = manager.getRepository(Team_Member)
            const ticketRepo = manager.getRepository(Ticket)
            const tickethistoryRepo =manager.getRepository(Ticket_History)
            const notificationRepo = manager.getRepository(Notification)

            const team_member = await teamMemberRepo.findOne({
                where: { id: member, is_active: true, department: { id: dept.id } },
                lock: { mode: 'pessimistic_write' }
            })

            if (!team_member) {
                throw new Error('Member Not Found')
            }
            if (team_member.active_tickets >= 5) {
                throw new Error('Ticket Limit Reached')
            }

            let ticket_id
            let exists = true
            while (exists) {
                ticket_id = Math.floor(1000 + Math.random() * 9000)
                exists = !!(await ticketRepo.findOneBy({ ticket_id }))
            }

            const ticket = ticketRepo.create({
                ticket_id,
                subject: subject.trim(),
                description: description.trim(),
                status: 'Open',
                priority,
                due_at,
                department: { id: dept.id },
                team_member: { id: team_member.id },
                tech_admin: { id: tech_admin.id }
            })


            const saved = await ticketRepo.save(ticket);

            const history = tickethistoryRepo.create({
                old_status: null,
                new_status: 'Open',
                note: 'Ticket created',
                ticket: { id: saved.id },
                changed_by_admin: {id: tech_admin_id},
            });

            await tickethistoryRepo.save(history);

            await notificationRepo.save(notificationRepo.create({
                message: `New ticket #${saved.ticket_id} has been assigned to you: ${saved.subject}`,
                ticket_id: saved.ticket_id,
                member: { id: team_member.id }
            }))

            team_member.active_tickets += 1;
            await teamMemberRepo.save(team_member);

            return saved
        })

        return res.status(201).json(savedTicket)

    }catch (err) {
        if (err.message === 'Member Not Found') {
            return res.status(404).json({ message: 'No active Team Member found in this department' })
        }
        if (err.message === 'Ticket Limit Reached') {
            return res.status(409).json({ message: 'Team Member has reached the maximum ticket limit' })
        }
        console.error(err)
        return res.status(500).json({ message: 'Error While Creating Ticket' })
    }
}



const Get_Tickets = async (req, res) => {
    try {
        const where = req.user.role === 'tech_admin'
            ? { tech_admin: { id: req.user.userId } }
            : undefined
        const ticket = await TicketRepository.find({
            ...(where ? { where } : {}),
            select: {
                id: true,
                ticket_id: true,
                subject: true,
                description: true,
                status: true,
                priority: true,
                created_at: true,
                updated_at: true,
                due_at: true,
                resolved_at: true,
                department: {
                    id: true,
                    dept_name: true
                },
                team_member: {
                    id: true,
                    name: true,
                    username: true,
                    active_tickets: true,
                    is_active: true
                },
                tech_admin: {
                    id: true,
                    name: true,
                    username: true
                }
            },
            relations: {
                department: true,
                team_member: true,
                tech_admin: true
            },
            order: {
                created_at: 'DESC'
            }
        })

        return res.status(200).json(ticket)

    } catch (err) {
        console.error(err)

        return res.status(500).json({
            message: 'Error While Getting Tickets'
        })
    }
}


const Get_My_Tickets = async (req, res) => {
    try {
        const ticket = await TicketRepository.find({
            where: { team_member: { id: req.user.userId } },
            select: {
                id: true, ticket_id: true, subject: true, description: true,
                status: true, priority: true, created_at: true, updated_at: true,
                due_at: true, resolved_at: true,
                department: { id: true, dept_name: true },
                team_member: { id: true, name: true, username: true }
            },
            relations: { department: true, team_member: true },
            order: { created_at: 'DESC' }
        })
        return res.status(200).json(ticket)
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Error While Getting Your Tickets' })
    }
}

const Get_Ticket_Reports = async (req, res) => {
    try {
        const { from, to } = req.query
        const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
        if (!isDate(from) || !isDate(to) || new Date(`${from}T00:00:00.000Z`).toISOString().slice(0, 10) !== from || new Date(`${to}T00:00:00.000Z`).toISOString().slice(0, 10) !== to || from > to) {
            return res.status(400).json({ message: 'Provide a valid from and to date range' })
        }

        const endExclusive = new Date(`${to}T00:00:00.000Z`)
        endExclusive.setUTCDate(endExclusive.getUTCDate() + 1)
        const query = TicketRepository.createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.department', 'department')
            .leftJoinAndSelect('ticket.team_member', 'team_member')
            .leftJoinAndSelect('ticket.tech_admin', 'tech_admin')
            .where('ticket.created_at >= :from', { from: `${from}T00:00:00.000Z` })
            .andWhere('ticket.created_at < :to', { to: endExclusive.toISOString() })
        if (req.user.role === 'tech_admin') query.andWhere('tech_admin.id = :techAdminId', { techAdminId: req.user.userId })

        const tickets = await query.orderBy('ticket.created_at', 'DESC').getMany()
        const byDepartment = new Map()
        const byMember = new Map()
        const statuses = {}
        let resolutionTotalMs = 0
        let resolutionCount = 0
        const now = Date.now()
        let overdue = 0

        for (const ticket of tickets) {
            statuses[ticket.status] = (statuses[ticket.status] || 0) + 1
            const departmentName = ticket.department?.dept_name || 'Unassigned'
            const departmentKey = ticket.department?.id || departmentName
            const departmentRow = byDepartment.get(departmentKey) || { name: departmentName, total: 0, resolved: 0, overdue: 0 }
            departmentRow.total += 1
            if (['Resolved', 'Closed'].includes(ticket.status)) departmentRow.resolved += 1
            const isOverdue = ticket.due_at && new Date(ticket.due_at).getTime() < now && !['Resolved', 'Closed'].includes(ticket.status)
            if (isOverdue) { overdue += 1; departmentRow.overdue += 1 }
            byDepartment.set(departmentKey, departmentRow)

            const memberName = ticket.team_member?.name || 'Unassigned'
            const memberKey = ticket.team_member?.id || `unassigned:${departmentKey}`
            const memberRow = byMember.get(memberKey) || { id: ticket.team_member?.id || null, name: memberName, department: departmentName, total: 0, active: 0, resolved: 0 }
            memberRow.total += 1
            if (['Open', 'In Progress'].includes(ticket.status)) memberRow.active += 1
            if (['Resolved', 'Closed'].includes(ticket.status)) memberRow.resolved += 1
            byMember.set(memberKey, memberRow)

            if (ticket.resolved_at && ticket.created_at) {
                const duration = new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime()
                if (Number.isFinite(duration) && duration >= 0) { resolutionTotalMs += duration; resolutionCount += 1 }
            }
        }

        return res.status(200).json({
            range: { from, to },
            summary: {
                total: tickets.length,
                resolved: (statuses.Resolved || 0) + (statuses.Closed || 0),
                overdue,
                average_resolution_hours: resolutionCount ? Math.round(resolutionTotalMs / resolutionCount / 3600000 * 10) / 10 : null,
                statuses
            },
            by_department: [...byDepartment.values()].sort((a, b) => b.total - a.total),
            by_member: [...byMember.values()].sort((a, b) => b.total - a.total)
        })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Could not generate ticket reports' })
    }
}

const Delete_Ticket = async (req, res) => {
    try {
        const { ticket_id } = req.params
        const { role, userId } = req.user

        if (!Number.isInteger(Number(ticket_id)) || Number(ticket_id) < 1000 || Number(ticket_id) > 9999) {
            return res.status(400).json({ message: 'Enter a valid four-digit ticket number' })
        }

        if (role !== 'tech_admin') {
            return res.status(403).json({ message: 'Only the Tech Admin who created the ticket can delete it' })
        }

        const techAdmin = await Tech_AdminRepository.findOneBy({ id: userId, is_active: true })
        if (!techAdmin) return res.status(403).json({ message: 'Active Tech Admin not found' })

        await AppDataSource.transaction(async manager => {
            const ticketRepo = manager.getRepository(Ticket)
            const teamMemberRepo = manager.getRepository(Team_Member)
            const lockedTicket = await ticketRepo
                .createQueryBuilder('ticket')
                .setLock('pessimistic_write')
                .where('ticket.ticket_id = :ticket_id', { ticket_id: Number(ticket_id) })
                .getOne()

            if (!lockedTicket) throw new Error('Ticket_Not_Found')

            const ticket = await ticketRepo.findOne({
                where: { id: lockedTicket.id },
                relations: { team_member: true, tech_admin: true }
            })

            if (!ticket) throw new Error('Ticket_Not_Found')
            if (ticket.tech_admin?.id !== userId) {
                throw new Error('Not_Ticket_Owner')
            }
            if (ticket.status !== 'Open') throw new Error('Ticket_Not_Open')

            if (ticket.team_member) {
                const assignedMember = await teamMemberRepo
                    .createQueryBuilder('member')
                    .setLock('pessimistic_write')
                    .where('member.id = :id', { id: ticket.team_member.id })
                    .getOne()

                if (!assignedMember) throw new Error('Member_Not_Found')
                if (assignedMember.active_tickets <= 0) throw new Error('Invalid_Ticket_Counter')

                assignedMember.active_tickets -= 1
                await teamMemberRepo.save(assignedMember)
            }

            await ticketRepo.softDelete({ id: ticket.id })
        })

        return res.status(200).json({ message: 'Ticket deleted successfully' })
    } catch (err) {
        const errors = {
            Ticket_Not_Found: [404, 'Ticket not found'],
            Not_Ticket_Owner: [403, 'You can only delete tickets created by your account'],
            Ticket_Not_Open: [400, 'Only Open tickets can be deleted'],
            Member_Not_Found: [404, 'The assigned Team Member was not found'],
            Invalid_Ticket_Counter: [409, 'Active ticket counter is inconsistent; please investigate']
        }

        if (errors[err.message]) {
            const [status, message] = errors[err.message]
            return res.status(status).json({ message })
        }

        console.error(err)
        return res.status(500).json({ message: 'Error while deleting ticket' })
    }
}

const Update_Ticket = async (req, res) => {
    try {
        const {ticket_id,edit_details,reassign,start_work,resolve,reject,close,reopen,reason} = req.body

        const role = req.user.role
        const userId = req.user.userId

        const operations = [edit_details, reassign,start_work, resolve, reject, close, reopen]
            .filter(value => value === true).length

        if (operations !== 1) {
            return res.status(400).json({message: 'Select exactly one ticket operation'})
        }

        if (!Number.isInteger(Number(ticket_id)) || Number(ticket_id) < 1000 || Number(ticket_id) > 9999) {
            return res.status(400).json({message: 'Enter a valid four-digit ticket number'})
        }

        if (reassign && role !== 'tech_admin') {
            return res.status(403).json({message: 'Only Tech Admin can reassign tickets'})
        }

        if ((start_work || resolve || reject) && role !== 'team_member') {
            return res.status(403).json({message: 'Only Team Members can perform this operation'})
        }

        if (edit_details && !['tech_admin', 'team_member'].includes(role)) {
            return res.status(403).json({message: 'Only Tech Admins or assigned Team Members can edit tickets'})
        }

        if (close && role !== 'tech_admin') {
            return res.status(403).json({message: 'Only Tech Admins can close resolved tickets'})
        }

        if (reopen && role !== 'tech_admin') {
            return res.status(403).json({ message: 'Only the ticket creator can reopen a resolved ticket' })
        }
        if (reopen && (typeof reason !== 'string' || reason.trim().length < 5 || reason.trim().length > 1000)) {
            return res.status(400).json({ message: 'Enter a reopening reason between 5 and 1000 characters' })
        }

        if (edit_details) {
            const { subject, description, priority, due_at } = req.body

            if (
                typeof subject !== 'string' ||
                typeof description !== 'string' ||
                typeof priority !== 'string' ||
                typeof due_at !== 'string'
            ) {
                return res.status(400).json({message: 'All ticket fields are required'})
            }

            if (!subject.trim()) {
                return res.status(400).json({message: 'Enter Subject'})
            }

            if (!description.trim()) {
                return res.status(400).json({message: 'Enter Description'})
            }

            if (!ALLOWED_PRIORITIES.includes(priority)) {
                return res.status(400).json({message: 'Select a valid Priority'})
            }

            if (!isValidFutureDate(due_at)) {
                return res.status(400).json({message: 'Due Date must be a valid future date'})
            }
        }

        if (reassign) {
            const { department, member } = req.body

            if (
                typeof department !== 'string' || !department.trim() ||
                typeof member !== 'string' || !member.trim()
            ) {
                return res.status(400).json({message: 'Select Department and Member'})
            }

            const dept = await DepartmentRepository.findOneBy({
                id: department,
                is_active: true
            })

            if (!dept) {
                return res.status(400).json({message: 'Invalid or inactive department'})
            }

            const tech_admin = await Tech_AdminRepository.findOneBy({
                id: userId,
                is_active: true
            })

            if (!tech_admin) {
                return res.status(403).json({message: 'Active Tech Admin not found'})
            }
        }

        if (close) {
            const tech_admin = await Tech_AdminRepository.findOneBy({
                id: userId,
                is_active: true
            })

            if (!tech_admin) {
                return res.status(403).json({message: 'Active Tech Admin not found'})
            }
        }

        const updatedTicket = await AppDataSource.transaction(async (manager) => {
                const ticketRepo = manager.getRepository(Ticket)
                const teamMemberRepo = manager.getRepository(Team_Member)
                const historyRepo = manager.getRepository(Ticket_History)
                const notificationRepo = manager.getRepository(Notification)

                const lockedTicket = await ticketRepo
                    .createQueryBuilder('ticket')
                    .setLock('pessimistic_write')
                    .where('ticket.ticket_id = :ticket_id', {ticket_id: Number(ticket_id)})
                    .getOne()

                if (!lockedTicket) {
                    throw new Error('Ticket_Not_Found')
                }

                const ticket = await ticketRepo.findOne({
                    where: { id: lockedTicket.id },
                    relations: {
                        team_member: true,
                        department: true,
                        tech_admin: true
                    }
                })

                if (!ticket) {
                    throw new Error('Ticket_Not_Found')
                }

                const isActive = ACTIVE_TICKET_STATUSES.includes(ticket.status)

                if (reassign && ticket.tech_admin?.id !== userId) {
                    throw new Error('Not_Ticket_Owner')
                }

                if (edit_details) {
                    if (role === 'tech_admin') {
                        if (!ticket.tech_admin || ticket.tech_admin.id !== userId) {
                            throw new Error('Not_Ticket_Owner')
                        }
                        if (!isActive && ticket.status !== 'Rejected') {
                            throw new Error('Ticket_Not_Editable')
                        }
                    } else if (!ticket.team_member || ticket.team_member.id !== userId) {
                        throw new Error('Not_Assigned_To_Member')
                    }

                    ticket.subject = req.body.subject.trim()
                    ticket.description = req.body.description.trim()
                    ticket.priority = req.body.priority
                    ticket.due_at = req.body.due_at

                    return await ticketRepo.save(ticket)
                }

                if (reassign) {
                    const isRejected = ticket.status === 'Rejected'

                    if (!isActive && !isRejected) {
                        throw new Error('Ticket_Not_Active')
                    }

                    const { department, member } = req.body

                    const dept = await DepartmentRepository.findOneBy({
                        id: department,
                        is_active: true
                    })

                    if (!dept) {
                        throw new Error('Department_Not_Found')
                    }

                    if (ticket.team_member && ticket.team_member.id === member) {
                        throw new Error('Same_Member')
                    }

                    const newMember = await teamMemberRepo.findOne({
                        where: {
                            id: member,
                            is_active: true
                        },
                        relations: {
                            department: true
                        }
                    })

                    if (!newMember || !newMember.department || newMember.department.id !== dept.id) {
                        throw new Error('Member_Not_Found')
                    }

                    const oldMemberId = ticket.team_member?.id

                    if (!oldMemberId) {
                        throw new Error('Old_Member_Not_Found')
                    }

                    const memberIds = [oldMemberId,newMember.id].sort()

                    const lockedMembers = await teamMemberRepo
                        .createQueryBuilder('member')
                        .setLock('pessimistic_write')
                        .where('member.id IN (:...ids)', {
                            ids: memberIds
                        })
                        .orderBy('member.id', 'ASC')
                        .getMany()

                    const oldMember = lockedMembers.find(m => m.id === oldMemberId)

                    const lockedNewMember = lockedMembers.find(m => m.id === newMember.id)

                    if (!oldMember || !lockedNewMember) {
                        throw new Error('Member_Not_Found')
                    }

                    if (!lockedNewMember.is_active) {
                        throw new Error('Member_Not_Found')
                    }

                    if (lockedNewMember.active_tickets >= 5) {
                        throw new Error('Ticket_Limit_Reached')
                    }

                    if (isActive && oldMember.active_tickets <= 0) {
                        throw new Error('Invalid_Ticket_Counter')
                    }

                    if (isActive) oldMember.active_tickets -= 1
                    lockedNewMember.active_tickets += 1

                    await teamMemberRepo.save([oldMember,lockedNewMember])

                    ticket.department = { id: dept.id }
                    ticket.team_member = { id: lockedNewMember.id }
                    if (isRejected) ticket.status = 'Open'

                    const savedTicket = await ticketRepo.save(ticket)

                    const history = historyRepo.create({
                        old_status: isRejected ? 'Rejected' : ticket.status,
                        new_status: ticket.status,
                        note: isRejected
                            ? `Rejected ticket reassigned from ${oldMemberId} to ${lockedNewMember.id}`
                            : `Ticket reassigned from ${oldMemberId} to ${lockedNewMember.id}`,
                        ticket: { id: ticket.id },
                        changed_by_admin: { id: userId }
                    })

                    await historyRepo.save(history)

                    await notificationRepo.save(notificationRepo.create({
                        message: `Ticket #${savedTicket.ticket_id} has been assigned to you: ${savedTicket.subject}`,
                        ticket_id: savedTicket.ticket_id,
                        member: { id: lockedNewMember.id }
                    }))

                    return savedTicket
                }

                if (start_work) {
                    if (role !== 'team_member') {
                        throw new Error('Only_Team_Member_Can_Start_Work')
                    }

                    if (!ticket.team_member || ticket.team_member.id !== userId) {
                        throw new Error('Not_Assigned_To_Member')
                    }

                    if (ticket.status !== 'Open') {
                        throw new Error('Invalid_Status_For_Start_Work')
                    }

                    const old_status = ticket.status
                    const new_status = 'In Progress'

                    ticket.status = new_status

                    const savedTicket = await ticketRepo.save(ticket)

                    const history = historyRepo.create({
                        old_status,
                        new_status,
                        note: 'Work started on the ticket',
                        ticket: { id: ticket.id },
                        changed_by_member: { id: userId }
                    })

                    await historyRepo.save(history)

                    return savedTicket
                }

                if (reject) {
                    if (!ticket.team_member || ticket.team_member.id !== userId) {
                        throw new Error('Not_Assigned_To_Member')
                    }

                    if (!isActive) {
                        throw new Error('Invalid_Status_For_Reject')
                    }

                    const assignedMember = await teamMemberRepo
                        .createQueryBuilder('member')
                        .setLock('pessimistic_write')
                        .where('member.id = :id', { id: userId })
                        .getOne()

                    if (!assignedMember) {
                        throw new Error('Member_Not_Found')
                    }

                    if (assignedMember.active_tickets <= 0) {
                        throw new Error('Invalid_Ticket_Counter')
                    }

                    const old_status = ticket.status
                    const new_status = 'Rejected'

                    assignedMember.active_tickets -= 1
                    ticket.status = new_status

                    await teamMemberRepo.save(assignedMember)
                    const savedTicket = await ticketRepo.save(ticket)

                    const history = historyRepo.create({
                        old_status,
                        new_status,
                        note: 'Ticket rejected by assigned team member; reassignment needed',
                        ticket: { id: ticket.id },
                        changed_by_member: { id: userId }
                    })

                    await historyRepo.save(history)

                    return savedTicket
                }

                if (resolve) {
                    if (!ticket.team_member ||
                        ticket.team_member.id !== userId) {
                        throw new Error('Not_Assigned_To_Member')
                    }

                    if (ticket.status !== 'In Progress') {
                        throw new Error('Invalid_Status_For_Resolve')
                    }

                    if (ticket.status === 'Resolved') {
                        throw new Error('Alredy_Resolved')
                    }

                    if (ticket.status === 'Closed') {
                        throw new Error('Alredy_Closed')
                    }

                    if (!isActive) {
                        throw new Error('Ticket_Not_Active')
                    }

                    const assignedMember = await teamMemberRepo
                        .createQueryBuilder('member')
                        .setLock('pessimistic_write')
                        .where('member.id = :id', { id: userId })
                        .getOne()

                    if (!assignedMember) {
                        throw new Error('Member_Not_Found')
                    }

                    if (assignedMember.active_tickets <= 0) {
                        throw new Error('Invalid_Ticket_Counter')
                    }

                    const old_status = ticket.status
                    const new_status = 'Resolved'

                    assignedMember.active_tickets -= 1
                    ticket.status = new_status
                    ticket.resolved_at = new Date()

                    await teamMemberRepo.save(assignedMember)
                    const savedTicket = await ticketRepo.save(ticket)

                    const history = historyRepo.create({
                        old_status,
                        new_status,
                        note: 'Ticket resolved',
                        ticket: { id: ticket.id },
                        changed_by_member: { id: userId }
                    })

                    await historyRepo.save(history)

                    return savedTicket
                }

                if (close) {
                    if (!ticket.tech_admin || ticket.tech_admin.id !== userId) {
                        throw new Error('Not_Ticket_Creator')
                    }

                    if (ticket.status !== 'Resolved') {
                        throw new Error('Invalid_Status_For_Close')
                    }

                    const old_status = ticket.status
                    const new_status = 'Closed'

                    ticket.status = new_status

                    const savedTicket = await ticketRepo.save(ticket)

                    const history = historyRepo.create({
                        old_status,
                        new_status,
                        note: 'Resolution confirmed by ticket creator',
                        ticket: { id: ticket.id },
                        changed_by_admin: { id: userId }
                    })

                    await historyRepo.save(history)

                    return savedTicket
                }

                if (reopen) {
                    if (!ticket.tech_admin || ticket.tech_admin.id !== userId) throw new Error('Not_Ticket_Creator')
                    if (ticket.status !== 'Resolved' || !ticket.resolved_at) throw new Error('Invalid_Status_For_Reopen')
                    const resolvedAt = new Date(ticket.resolved_at).getTime()
                    if (!Number.isFinite(resolvedAt) || Date.now() - resolvedAt > 7 * 24 * 60 * 60 * 1000) throw new Error('Reopen_Window_Expired')
                    if (!ticket.team_member) throw new Error('Member_Not_Found')

                    const assignedMember = await teamMemberRepo
                        .createQueryBuilder('member')
                        .setLock('pessimistic_write')
                        .where('member.id = :id', { id: ticket.team_member.id })
                        .getOne()
                    if (!assignedMember || !assignedMember.is_active) throw new Error('Member_Not_Found')
                    if (assignedMember.active_tickets >= 5) throw new Error('Ticket_Limit_Reached')

                    const old_status = ticket.status
                    ticket.status = 'Open'
                    ticket.resolved_at = null
                    assignedMember.active_tickets += 1
                    await teamMemberRepo.save(assignedMember)
                    const savedTicket = await ticketRepo.save(ticket)
                    await historyRepo.save(historyRepo.create({
                        old_status,
                        new_status: 'Open',
                        note: `Ticket reopened: ${reason.trim()}`,
                        ticket: { id: ticket.id },
                        changed_by_admin: { id: userId }
                    }))
                    await notificationRepo.save(notificationRepo.create({
                        message: `Ticket #${savedTicket.ticket_id} was reopened: ${reason.trim()}`,
                        ticket_id: savedTicket.ticket_id,
                        member: { id: assignedMember.id }
                    }))
                    return savedTicket
                }
            }
        )

        return res.status(200).json({
            message: 'Ticket updated successfully',
            ticket: updatedTicket
        })

    } catch (err) {
        const errors = {
            Ticket_Not_Found: [404, 'Ticket not found'],
            Not_Ticket_Owner: [403, 'You can only edit or reassign tickets created by your account'],
            Not_Ticket_Creator: [403, 'Only the Tech Admin who created the ticket can perform this action'],
            Not_Assigned_To_Member: [
                403,
                'You can only update tickets assigned to you'
            ],
            Department_Not_Found: [
                400,
                'Invalid or inactive department'
            ],
            Member_Not_Found: [
                404,
                'No active Team Member found in this department'
            ],
            OLD_Member_Not_Found: [
                409,
                'Current assigned Team Member not found'
            ],
            Ticket_Limit_Reached: [
                409,
                'Team Member has reached the maximum of 5 active tickets'
            ],
            Same_Member: [
                400,
                'Ticket is already assigned to this Team Member'
            ],
            Ticket_Not_Active: [
                400,
                'Only Open, In Progress, or Rejected tickets can be reassigned'
            ],
            Ticket_Not_Editable: [400, 'Only Open, In Progress, or Rejected tickets can be edited'],
            Alredy_Resolved: [
                400,
                'Ticket is already resolved'
            ],
            Alredy_Closed: [
                400,
                'Ticket is already closed'
            ],
            Invalid_Ticket_Counter: [
                409,
                'Active ticket counter is inconsistent please investigate'
            ],
            Only_Team_Member_Can_Start_Work: [
                403,
                'Only Team Members can start work'
            ],
            Invalid_Status_For_Start_Work: [
                400,
                'Only Open tickets can be started'
            ],
            Invalid_Status_For_Resolve: [
                400,
                'Only In Progress tickets can be resolved'
            ],
            Invalid_Status_For_Reject: [
                400,
                'Only Open or In Progress tickets can be rejected'
            ],
            Invalid_Status_For_Close: [
                400,
                'Only Resolved tickets can be closed'
            ],
            Invalid_Status_For_Reopen: [400, 'Only recently resolved tickets can be reopened'],
            Reopen_Window_Expired: [400, 'Tickets can only be reopened within 7 days of resolution']

        }

        if (errors[err.message]) {
            const [status, message] = errors[err.message]

            return res.status(status).json({ message })
        }

        console.error(err)

        return res.status(500).json({message: 'Error While Updating Ticket'})
    }
}

module.exports={Create_Ticket,Get_Tickets,Get_My_Tickets,Get_Ticket_Reports,Update_Ticket,Delete_Ticket}

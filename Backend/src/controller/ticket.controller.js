const { Tech_AdminRepository } = require('../repositories/tech_admin.repository')
const { DepartmentRepository } = require('../repositories/department.repository')
const { AppDataSource } = require('../config/database')
const {TicketRepository}=require('../repositories/ticket.repository')
const {Team_MemberRepository}=require('../repositories/team_member.repository')
const {Team_Member}=require('../entities/team_member.entity')
const {Ticket}=require('../entities/ticket.entity')
const {Ticket_History}=require('../entities/ticket_history.entity')

const ALLOWED_PRIORITIES = ['Low', 'Medium', 'High']
const ACTIVE_TICKET_STATUSES = ['Open', 'In Progress']  

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
            res.status(400).json({ message: 'Select Department' })
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
        const ticket = await TicketRepository.find({
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
                    username: true
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

const Update_Ticket = async (req, res) => {
    try {
        const {ticket_id,edit_details,reassign,start_work,resolve,close} = req.body

        const role = req.user.role
        const userId = req.user.userId

        const operations = [edit_details, reassign,start_work, resolve, close]
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

        if ((edit_details || start_work || resolve || close) && role !== 'team_member') {
            return res.status(403).json({message: 'Only Team Members can perform this operation'})
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

        const updatedTicket = await AppDataSource.transaction(async (manager) => {
                const ticketRepo = manager.getRepository(Ticket)
                const teamMemberRepo = manager.getRepository(Team_Member)
                const historyRepo = manager.getRepository(Ticket_History)

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
                        department: true
                    }
                })

                if (!ticket) {
                    throw new Error('Ticket_Not_Found')
                }

                const isActive = ACTIVE_TICKET_STATUSES.includes(ticket.status)

                if (edit_details) {
                    if (!ticket.team_member || ticket.team_member.id !== userId) {
                        throw new Error('Not_Assigned_To_Member')
                    }

                    ticket.subject = req.body.subject.trim()
                    ticket.description = req.body.description.trim()
                    ticket.priority = req.body.priority
                    ticket.due_at = req.body.due_at

                    return await ticketRepo.save(ticket)
                }

                if (reassign) {
                    if (!isActive) {
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

                    if (oldMember.active_tickets <= 0) {
                        throw new Error('Invalid_Ticket_Counter')
                    }

                    oldMember.active_tickets -= 1
                    lockedNewMember.active_tickets += 1

                    await teamMemberRepo.save([oldMember,lockedNewMember])

                    ticket.department = { id: dept.id }
                    ticket.team_member = { id: lockedNewMember.id }

                    const savedTicket = await ticketRepo.save(ticket)

                    const history = historyRepo.create({
                        old_status: ticket.status,
                        new_status: ticket.status,
                        note: `Ticket reassigned from ${oldMemberId} to ${lockedNewMember.id}`,
                        ticket: { id: ticket.id },
                        changed_by_admin: { id: userId }
                    })

                    await historyRepo.save(history)

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
                    if (!ticket.team_member || ticket.team_member.id !== userId) {
                        throw new Error('Not_Assigned_To_Member')
                    }

                    if (ticket.status !== 'In Progress') {
                        throw new Error('Invalid_Status_For_Close')
                    }

                    if (ticket.status === 'Resolved') {
                        throw new Error('Alredy_Resolved')
                    }

                    if (ticket.status === 'Closed') {
                        throw new Error('Alredy_Closed')
                    }

                    if (isActive) {
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

                        assignedMember.active_tickets -= 1

                        await teamMemberRepo.save(assignedMember)
                    }

                    const old_status = ticket.status
                    const new_status = 'Closed'

                    ticket.status = new_status

                    const savedTicket = await ticketRepo.save(ticket)

                    const history = historyRepo.create({
                        old_status,
                        new_status,
                        note: 'Ticket closed',
                        ticket: { id: ticket.id },
                        changed_by_member: { id: userId }
                    })

                    await historyRepo.save(history)

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
                'Only active tickets can be reassigned or resolved'
            ],
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
            Invalid_Status_For_Close: [
                400,
                'Only Resolved tickets can be closed'
            ]

        }

        if (errors[err.message]) {
            const [status, message] = errors[err.message]

            return res.status(status).json({ message })
        }

        console.error(err)

        return res.status(500).json({message: 'Error While Updating Ticket'})
    }
}

module.exports={Create_Ticket,Get_Tickets,Get_My_Tickets,Update_Ticket}

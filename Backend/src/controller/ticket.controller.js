const { Tech_AdminRepository } = require('../repositories/tech_admin.repository')
const { DepartmentRepository } = require('../repositories/department.repository')
const { AppDataSource } = require('../config/database')
const {TicketRepository}=require('../repositories/ticket.repository')
const {Team_MemberRepository}=require('../repositories/team_member.repository')
const {Team_Member}=require('../entities/team_member.entity')
const {Ticket}=require('../entities/ticket.entity')

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

            const saved = await ticketRepo.save(ticket)

            team_member.active_tickets += 1
            await teamMemberRepo.save(team_member)

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


module.exports={Create_Ticket,Get_Tickets}
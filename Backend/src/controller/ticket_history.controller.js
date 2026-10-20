
const { Ticket_HistoryRepository } = require('../repositories/ticket_history.repository')

const Get_Ticket_History = async (req, res) => {
    try {
        const where = req.user.role === 'tech_admin'
            ? { ticket: { tech_admin: { id: req.user.userId } } }
            : undefined
        const ticket_history = await Ticket_HistoryRepository.find({
            ...(where ? { where } : {}),
            select: {
                id: true,
                note: true,
                old_status: true,
                new_status: true,
                created_at: true,

                ticket: {
                    id: true,
                    ticket_id: true
                },

                changed_by_member: {
                    id: true,
                    name: true,
                    username: true
                },

                changed_by_admin: {
                    id: true,
                    username: true
                }
            },

            relations: {
                ticket: true,
                changed_by_member: true,
                changed_by_admin: true
            },

            order: {
                created_at: 'DESC'
            }
        })

        return res.status(200).json(ticket_history)

    } catch (err) {
        console.error(err)

        return res.status(500).json({message: 'Error While Getting Tickets History'})
    }
}

const Get_My_Ticket_History = async (req, res) => {
    try {
        const history = await Ticket_HistoryRepository.find({
            where: { ticket: { team_member: { id: req.user.userId } } },
            select: {
                id: true,
                note: true,
                old_status: true,
                new_status: true,
                created_at: true,
                ticket: { id: true, ticket_id: true },
                changed_by_member: { id: true, name: true, username: true },
                changed_by_admin: { id: true, username: true }
            },
            relations: { ticket: true, changed_by_member: true, changed_by_admin: true },
            order: { created_at: 'DESC' }
        })
        return res.status(200).json(history)
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Error While Getting Your Ticket History' })
    }
}

module.exports = { Get_Ticket_History, Get_My_Ticket_History }

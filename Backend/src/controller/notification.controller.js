const { AppDataSource } = require('../config/database')
const { Notification } = require('../entities/notification.entity')

const Get_My_Notifications = async (req, res) => {
    try {
        const notifications = await AppDataSource.getRepository(Notification).find({
            where: { member: { id: req.user.userId } },
            select: {
                id: true,
                message: true,
                ticket_id: true,
                created_at: true,
                read_at: true
            },
            order: { created_at: 'DESC' },
            take: 50
        })

        return res.status(200).json({
            notifications,
            unreadCount: notifications.filter(notification => !notification.read_at).length
        })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Error while getting notifications' })
    }
}

const Mark_Notification_Read = async (req, res) => {
    try {
        const { id } = req.params
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
            return res.status(400).json({ message: 'Enter a valid notification ID' })
        }

        const repository = AppDataSource.getRepository(Notification)
        const notification = await repository.findOne({
            where: { id, member: { id: req.user.userId } }
        })
        if (!notification) return res.status(404).json({ message: 'Notification not found' })

        if (!notification.read_at) {
            notification.read_at = new Date()
            await repository.save(notification)
        }

        return res.status(200).json({ message: 'Notification marked as read', read_at: notification.read_at })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Error while updating notification' })
    }
}

module.exports = { Get_My_Notifications, Mark_Notification_Read }

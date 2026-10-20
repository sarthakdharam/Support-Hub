const { Tech_AdminRepository } = require('../repositories/tech_admin.repository')
const { Team_MemberRepository } = require('../repositories/team_member.repository')

const Get_My_Profile = async (req, res) => {
    try {
        const repository = req.user.role === 'tech_admin' ? Tech_AdminRepository : Team_MemberRepository
        const profile = await repository.findOne({
            where: { id: req.user.userId },
            select: { id: true, username: true, name: true, email: true, phone: true, address: true, profile_photo: true, profile_photo_mime: true },
            ...(req.user.role === 'team_member' ? { relations: { department: true } } : {})
        })
        if (!profile) return res.status(404).json({ message: 'Profile not found' })
        const { profile_photo, profile_photo_mime, ...details } = profile
        return res.status(200).json({
            ...details,
            profile_photo_data_url: profile_photo && profile_photo_mime
                ? `data:${profile_photo_mime};base64,${profile_photo.toString('base64')}`
                : null
        })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: 'Error While Getting Profile' })
    }
}

module.exports = { Get_My_Profile }

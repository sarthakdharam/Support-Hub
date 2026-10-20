const jwt = require('jsonwebtoken')
const { Super_AdminRepository } = require('../repositories/super_admin.repository')
const { Tech_AdminRepository } = require('../repositories/tech_admin.repository')
const { Team_MemberRepository } = require('../repositories/team_member.repository')

const Refresh_Token = async (req, res) => {
    const { refreshToken } = req.body || {}
    if (typeof refreshToken !== 'string' || !refreshToken.trim()) {
        return res.status(400).json({ message: 'Refresh token is required' })
    }

    try {
        const payload = jwt.verify(refreshToken, process.env.REFRESH_SECRET)
        if (!payload.userId || !['super_admin', 'tech_admin', 'team_member'].includes(payload.role)) {
            return res.status(401).json({ message: 'Invalid refresh token' })
        }

        let account
        if (payload.role === 'super_admin') {
            account = await Super_AdminRepository.findOneBy({ id: payload.userId })
        } else if (payload.role === 'tech_admin') {
            account = await Tech_AdminRepository.findOneBy({ id: payload.userId })
        } else {
            account = await Team_MemberRepository.findOneBy({ id: payload.userId })
        }
        if (!account || (payload.role !== 'super_admin' && !account.is_active)) {
            return res.status(401).json({ message: 'Account is unavailable. Please log in again.' })
        }

        const claims = { userId: payload.userId, role: payload.role }
        const accessToken = jwt.sign(claims, process.env.JWT_SECRET, { expiresIn: '15m' })
        const nextRefreshToken = jwt.sign(claims, process.env.REFRESH_SECRET, { expiresIn: '7d' })
        return res.status(200).json({ accessToken, refreshToken: nextRefreshToken })
    } catch (err) {
        return res.status(401).json({ message: 'Refresh token is invalid or expired. Please log in again.' })
    }
}

module.exports = { Refresh_Token }

const {AppDataSource}=require('../config/database')
const {Team_Member}=require('../entities/team_member.entity')


const Team_MemberRepository=AppDataSource.getRepository(Team_Member)

module.exports={Team_MemberRepository};
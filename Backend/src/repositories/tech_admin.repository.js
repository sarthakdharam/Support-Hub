const {AppDataSource}=require('../config/database')
const {Tech_Admin}=require('../entities/tech_admin.entity')


const Tech_AdminRepository=AppDataSource.getRepository(Tech_Admin)

module.exports={Tech_AdminRepository};
const {AppDataSource}=require('../config/database')
const {Super_Admin}=require('../entities/super_admin.entity')


const Super_AdminRepository=AppDataSource.getRepository(Super_Admin)

module.exports={Super_AdminRepository};
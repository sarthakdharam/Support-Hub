const {AppDataSource}=require('../config/database')
const {Department}=require('../entities/department.entity')


const DepartmentRepository=AppDataSource.getRepository(Department)

module.exports={DepartmentRepository};
const {DataSource}=require('typeorm')

const {Super_Admin}=require('../entities/super_admin.entity')
const {Tech_Admin}=require('../entities/tech_admin.entity')
const {Department}=require('../entities/department.entity')
const {Team_Member}=require('../entities/team_member.entity')
const {Ticket}=require('../entities/ticket.entity')
const {Ticket_History}=require('../entities/ticket_history.entity')
const {Notification}=require('../entities/notification.entity')

const AppDataSource=new DataSource({
    type:'postgres',
    host:'localhost',
    port:5432,
    username:'postgres',
    password:'password',
    database:'Support Hub',
    synchronize:true,
    logging:false,
    entities:[
        Super_Admin,Tech_Admin,Department,Team_Member,Ticket,Ticket_History,Notification
    ]
})

module.exports={AppDataSource}

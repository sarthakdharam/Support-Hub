const express=require('express')
const {AppDataSource}=require('./config/database')
const {seedSuper_Admin}=require('./seed/super_Admin.seed')
const {login}=require('./controller/login.controller')
const app=express()
const {Create_Tech_Admin,Get_Tech_Admin, Update_Tech_Admin, Delete_Tech_Admin, Activate_Tech_Admin}=require('./controller/tech_admin.controller')
const {Create_Team_Member,Get_Team_Member,Update_Team_Member,Delete_Team_Member,Activate_Team_Member}=require('./controller/team_member.controller')
const {Create_Department,Get_Department,Delete_Department,Activate_Department}=require('./controller/department.controller')
const {authenticate}=require('./middleware/authentication.middleware')
const {authorize}=require('./middleware/authorization.middleware')
const { Create_Ticket, Get_Tickets } = require('./controller/ticket.controller')
require('dotenv').config();

app.use(express.json())

app.post('/api/login',login)
//TECH ADMIN
app.post('/api/tech_admin',authenticate,authorize(['super_admin']),Create_Tech_Admin)
app.get('/api/tech_admin',authenticate,authorize(['super_admin']),Get_Tech_Admin)
app.patch('/api/tech_admin',authenticate,authorize(['tech_admin']),Update_Tech_Admin)
app.patch('/api/tech_admin/deactivate/:id',authenticate,authorize(['super_admin']),Delete_Tech_Admin)
app.patch('/api/tech_admin/activate/:id',authenticate,authorize(['super_admin']),Activate_Tech_Admin)
//TEAM MEMBER
app.post('/api/team_member',authenticate,authorize(['tech_admin']),Create_Team_Member)
app.get('/api/team_member',authenticate,authorize(['tech_admin']),Get_Team_Member)
app.patch('/api/team_member',authenticate,authorize(['team_member']),Update_Team_Member)
app.patch('/api/team_member/deactivate/:id',authenticate,authorize(['tech_admin']),Delete_Team_Member)
app.patch('/api/team_member/activate/:id',authenticate,authorize(['tech_admin']),Activate_Team_Member)
// DEPARTMENT
app.post('/api/department',authenticate,authorize(['super_admin']),Create_Department)
app.get('/api/department',authenticate,authorize(['super_admin','tech_admin']),Get_Department)
app.patch('/api/department/deactivate/:id',authenticate,authorize(['super_admin']),Delete_Department)
app.patch('/api/department/activate/:id',authenticate,authorize(['super_admin']),Activate_Department)
// Ticket
app.post('/api/ticket',authenticate,authorize(['tech_admin']),Create_Ticket)
app.get('/api/ticket',authenticate,authorize(['super_admin','tech_admin']),Get_Tickets)

async function start(){
    
    try{
        await AppDataSource.initialize();
        console.log('Database connected .....')
        
        seedSuper_Admin()

        app.listen(3000,()=>{
            console.log('Server running on http://localhost:3000')
        })
    }catch(err){
        console.log(err)
    }
}
start()

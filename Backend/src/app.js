const express=require('express')
const {AppDataSource}=require('./config/database')
const {seedSuper_Admin}=require('./seed/super_Admin.seed')
const {login}=require('./controller/login.controller')
const app=express()
const {Create_Tech_Admin,Get_Tech_Admin, Update_Tech_Admin, Delete_Tech_Admin, Activate_Tech_Admin}=require('./controller/tech_admin.controller')
const {authenticate}=require('./middleware/authentication.middleware')
const {authorize}=require('./middleware/authorization.middleware')
require('dotenv').config();

app.use(express.json())

app.post('/api/login',login)
app.post('/api/tech_admin',authenticate,authorize(['super_admin']),Create_Tech_Admin)
app.get('/api/tech_admin',authenticate,authorize(['super_admin']),Get_Tech_Admin)
app.patch('/api/tech_admin',authenticate,authorize(['tech_admin']),Update_Tech_Admin)
app.patch('/api/tech_admin/deactivate/:id',authenticate,authorize(['super_admin']),Delete_Tech_Admin)
app.patch('/api/tech_admin/activate/:id',authenticate,authorize(['super_admin']),Activate_Tech_Admin)

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

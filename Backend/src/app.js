const express=require('express')
const {AppDataSource}=require('./config/database')
const {seedSuper_Admin}=require('./seed/super_Admin.seed')
const {login}=require('./controller/login.controller')
const app=express()
require('dotenv').config();

app.use(express.json())

app.post('/api/login',login)

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

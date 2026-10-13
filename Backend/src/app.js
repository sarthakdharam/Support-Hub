const express=require('express')
const {AppDataSource}=require('./config/database')
const {seedSuper_Admin}=require('./seed/super_Admin.seed')

const app=express()

app.use(express.json())

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

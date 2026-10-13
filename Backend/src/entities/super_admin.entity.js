const {EntitySchema}=require('typeorm')

const Super_Admin=new EntitySchema({
    name:'Super_Admin',
    tableName:'super_admin',
    columns:{
        id:{
            type:'uuid',
            primary:true,
            generated:'uuid',
        },        
        username:{
            type:'varchar',
            unique: true,
        },
        password:{
            type:'varchar',
            length:255,
            select:false,
        }             
    }
})
module.exports = {Super_Admin}
const {EntitySchema}=require('typeorm')

const Department=new EntitySchema({
    name:'Department',
    tableName:'department',
    columns:{
        id:{
            type:'uuid',
            primary:true,
            generated:'uuid',
        },
        dept_name:{
            type:'varchar',
            unique:true,
            nullable:false
        },
        is_active:{
            type:'boolean',
            default:true
        },
        created_at:{
            type:'timestamp',
            createDate:true,
        },
        Responsibilities:{
            type:'varchar',
            nullable:false
        }

    }
})
module.exports = {Department};
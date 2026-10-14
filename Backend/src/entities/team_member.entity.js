const {EntitySchema}=require('typeorm')

const Team_Member=new EntitySchema({
    name:'Team_Member',
    tableName:'team_member',
    columns:{
        id:{
            primary:true,
            type:'uuid',
            generated:'uuid'
        },
        username:{
            type:'varchar',
            unique:true,
            nullable:false
        },
        name:{
            type:'varchar',
            nullable:false
        },
        email:{
            type:'varchar',
            unique:true,
            nullable:false
        },
        phone:{
            type:'varchar',
            unique:true,
            length:10,
            nullable:false
        },
        password:{
            type:'varchar',
            length:255,
            select:false
        },
        address:{
            type:'varchar',
            nullable:false
        },
        profile_photo:{
            type:'bytea',
            nullable:true
        },
        created_at:{
            type:'timestamp',
            createDate:true,
        },
        updated_at:{
            type:'timestamp',
            updateDate:true,
        },
        is_active:{
            type:'boolean',
            default:true,
        },
        profile_photo_mime: {
            type: 'varchar',
            nullable:true
        }
    },
    relations: {
        department: {
            type: 'many-to-one',
            target: 'Department',
            joinColumn: {
                name: 'dept_id',
                referencedColumnName: 'id',
            },
            nullable: true,
        },
    }
})

module.exports={Team_Member}
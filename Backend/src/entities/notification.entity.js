const { EntitySchema } = require('typeorm')

const Notification = new EntitySchema({
    name: 'Notification',
    tableName: 'notification',
    columns: {
        id: {
            primary: true,
            type: 'uuid',
            generated: 'uuid'
        },
        message: {
            type: 'text',
            nullable: false
        },
        ticket_id: {
            type: 'int',
            nullable: true
        },
        created_at: {
            type: 'timestamp',
            createDate: true
        },
        read_at: {
            type: 'timestamp',
            nullable: true
        }
    },
    relations: {
        member: {
            type: 'many-to-one',
            target: 'Team_Member',
            joinColumn: {
                name: 'member_id',
                referencedColumnName: 'id'
            },
            onDelete: 'CASCADE',
            nullable: false
        }
    }
})

module.exports = { Notification }

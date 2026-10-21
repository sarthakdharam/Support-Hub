
const { EntitySchema } = require('typeorm');

const Ticket = new EntitySchema({
    name: 'Ticket',
    tableName: 'ticket',

    columns: {
        id: {
            primary: true,
            type: 'uuid',
            generated: 'uuid',
        },

        ticket_id: {
            type: 'int',
            unique: true,
            nullable:false
        },

        subject: {
            type: 'varchar',
            nullable: false,
        },

        description: {
            type: 'text',
            nullable: false,
        },

        status: {
            type: 'varchar',
            default: 'OPEN',
            nullable: false,
        },

        priority: {
            type: 'varchar',
            default: 'MEDIUM',
            nullable: false,
        },

        created_at: {
            type: 'timestamp',
            createDate: true,
        },

        updated_at: {
            type: 'timestamp',
            updateDate: true,
        },

        due_at: {
            type: 'timestamp',
            nullable: true,
        },

        resolved_at: {
            type: 'timestamp',
            nullable: true,
        },

        deleted_at: {
            type: 'timestamp',
            nullable: true,
            deleteDate: true,
        },
    },

    relations: {
        department: {
            type: 'many-to-one',
            target: 'Department',
            joinColumn: {
                name: 'dept_id',
                referencedColumnName: 'id',
            },
            nullable: false,
        },

        team_member: {
            type: 'many-to-one',
            target: 'Team_Member',
            joinColumn: {
                name: 'member_id',
                referencedColumnName: 'id',
            },
            nullable: true,
        },

        tech_admin: {
            type: 'many-to-one',
            target: 'Tech_Admin',
            joinColumn: {
                name: 'created_by',
                referencedColumnName: 'id',
            },
            nullable: false,
        },
    },
});

module.exports = { Ticket };

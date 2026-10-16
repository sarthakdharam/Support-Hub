
const { EntitySchema } = require('typeorm');

const Ticket_History = new EntitySchema({
    name: 'Ticket_History',
    tableName: 'ticket_history',

    columns: {
        id: {
            primary: true,
            type: 'uuid',
            generated: 'uuid',
        },

        old_status: {
            type: 'varchar',
            nullable: true,
        },

        new_status: {
            type: 'varchar',
            nullable: false,
        },

        note: {
            type: 'text',
            nullable: true,
        },

        created_at: {
            type: 'timestamp',
            createDate: true,
        },
    },

    relations: {
        changed_by_member: {
            type: 'many-to-one',
            target: 'Team_Member',
            joinColumn: {
                name: 'changed_by_member_id',
                referencedColumnName: 'id',
            },
            nullable: true,
        },

        changed_by_admin: {
            type: 'many-to-one',
            target: 'Tech_Admin',
            joinColumn: {
                name: 'changed_by_admin_id',
                referencedColumnName: 'id',
            },
            nullable: true,
        },

        ticket: {
            type: 'many-to-one',
            target: 'Ticket',
            joinColumn: {
                name: 'ticket_id',
                referencedColumnName: 'id',
            },
            nullable: false,
        },
    },
});

module.exports = { Ticket_History };

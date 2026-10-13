const {AppDataSource}=require('../config/database')
const {Ticket}=require('../entities/ticket.entity')


const TicketRepository=AppDataSource.getRepository(Ticket)

module.exports={TicketRepository};
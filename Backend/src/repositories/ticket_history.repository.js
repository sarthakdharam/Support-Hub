const {AppDataSource}=require('../config/database')
const {Ticket_History}=require('../entities/ticket_history.entity')


const Ticket_HistoryRepository=AppDataSource.getRepository(Ticket_History)

module.exports={Ticket_HistoryRepository};
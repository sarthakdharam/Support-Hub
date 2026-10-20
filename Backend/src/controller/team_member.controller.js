const {Tech_AdminRepository}=require('../repositories/tech_admin.repository')
const {Super_AdminRepository}=require('../repositories/super_admin.repository')
const {Team_MemberRepository}=require('../repositories/team_member.repository')
const {DepartmentRepository}=require('../repositories/department.repository')
const bcrypt=require('bcrypt')
const { Not } = require('typeorm')
const { readProfilePhoto } = require('../utils/profile_photo')


const Create_Team_Member=async (req,res)=>{
    try{

        const {username,name,email,phone,password,address,department}=req.body
        const tech_admin_id=req.user.userId

        if (typeof username !== 'string' ||
            typeof name !== 'string' ||
            typeof email !== 'string' ||
            typeof phone !== 'string' ||
            typeof password !== 'string' ||
            typeof address !== 'string' ||
            typeof department !== 'string' 
        ) {
            return res.status(400).json({
                message: 'All fields are required'
            })
        }

        if(username.trim()===''){
            return res.status(400).json({message:'Enter Username'})
        }

        if(name.trim()===''){
            return res.status(400).json({message:'Enter Name'})
        }

        if(email.trim()===''){
            return res.status(400).json({message:'Enter email'})
        }else{
            const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

            if (!emailPattern.test(email.trim())) {
                return res.status(400).json({message:'Enter Valid Email'})
            }
        }

        if(phone.trim()===''){
            return res.status(400).json({message:'Enter Phone no.'})
        }else if(!/^\d{10}$/.test(phone)){
            return res.status(400).json({message:'Phone no. should be of 10 digit'})
        }

        if(password.trim()===''){
            return res.status(400).json({message:'Enter password'})
        }else{
            const passwordvalid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=])[A-Za-z\d@$!%*?&#^()_+\-=]{8,}$/

            if (!passwordvalid.test(password.trim())) {
                return res.status(400).json({message:`use 8+ character with Uppercase,Lowercase,Number and Special Character`})
            }
        }

        if(address.trim()===''){
            return res.status(400).json({message:'Enter Address'})
        }

        if(department.trim()===''){
            return res.status(400).json({message:'Enter Department'})
        }
        
        
        const super_admin=await Super_AdminRepository.findOneBy({username:username})
        const team_member=await Team_MemberRepository.findOne({where:[{username:username},{email:email},{phone:phone}]})
        const tech_admin= await Tech_AdminRepository.findOne({where:[{username:username},{email:email},{phone:phone}]})


        if(super_admin || team_member || tech_admin){
            console.log('username is already exists')
            return res.status(409).json({
                message:'Username, email, or phone number already exists'
            })
        }
        const dept=await DepartmentRepository.findOneBy({dept_name:department, is_active:true})

        if(!dept){
            console.log('Department name should from department')
            return res.status(409).json({
                message:'There No Such Department'
            })
        }

        const hashPassword = await bcrypt.hash(password,10)

        const team_members=Team_MemberRepository.create({
            username,
            name,
            email,
            phone,
            password:hashPassword,
            address,
            department: { id: dept.id },
            tech_admin: { id: tech_admin_id }
        })

        const save_team_member=await Team_MemberRepository.save(team_members)
        const { password:_ , ...team_memberWithoutPassword } = save_team_member
        return res.status(201).json(team_memberWithoutPassword)       

    }catch(err){
        console.log(err)
        return res.status(500).json({message:'Error While Creating Team Member', error: err.message})
    }
}

const Get_Team_Member=async (req,res)=>{
    try{

        const where = req.user.role === 'tech_admin'
            ? { tech_admin: { id: req.user.userId } }
            : undefined
        const team_member=await Team_MemberRepository.find({
            ...(where ? { where } : {}),
            select:{
                id:true,
                username:true,
                name:true,
                email:true,
                phone:true,
                address:true,
                is_active:true,
                active_tickets:true,
            },
            relations:{
                department:true
            },
            order:{
                id:'ASC'
            }
        })
        res.status(200).json(team_member)
        
    }catch(err){
        console.log(err)
        return res.status(500).json({message:'Error While Getting Team Member', error: err.message})
    }
}

const Update_Team_Member=async (req,res)=>{
    try{

        const team_member_id=req.user.userId

        const team_member=await Team_MemberRepository.findOneBy({id:team_member_id})
        
        if(!team_member){
            return res.status(404).json({message:'Team Member Not Found'})
        }

        const {name,email,phone,password,address}=req.body

        const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

        if(email && !emailPattern.test(email.trim())){
           return res.status(400).json({message:'Enter a valid email address'})
        }

        if(phone && !/^\d{10}$/.test(phone.trim())){
            return res.status(400).json({message:'Phone number should be 10 digits'})
        }
        const passwordvalid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=])[A-Za-z\d@$!%*?&#^()_+\-=]{8,}$/
        if(password){
            if(!passwordvalid.test(password)){
                return res.status(400).json({message:'use 8+ character with Uppercase,Lowercase,Number and Special Character'})
            }
        }

        const new_email = email?.trim().toLowerCase()
        const new_phone = phone?.trim()

        const conditions = []
        if (new_email) conditions.push({ email: new_email })
        if (new_phone) conditions.push({ phone: new_phone })

        if (conditions.length > 0) {
            const [tech_admin, other_member] = await Promise.all([
                Tech_AdminRepository.findOne({ where: conditions }),
                Team_MemberRepository.findOne({
                    where: conditions.map(c => ({ ...c, id: Not(team_member.id) }))
                })
            ])

            if (tech_admin || other_member) {
                return res.status(409).json({ message: 'Email or phone number already exists' })
            }
        }



        if(name) team_member.name=name
        if(new_email) team_member.email=new_email
        if(new_phone) team_member.phone=new_phone
        if(password) {
            team_member.password=await bcrypt.hash(password, 10)
        }
        if(address) team_member.address=address
        const profilePhoto = req.file
            ? { buffer: req.file.buffer, mime: req.file.mimetype }
            : readProfilePhoto(req.body.profile_photo_data_url)
        if(profilePhoto){
            team_member.profile_photo=profilePhoto.buffer
            team_member.profile_photo_mime=profilePhoto.mime
        }

        const updated_team_member=await Team_MemberRepository.save(team_member)
        const {password: _, ...team_member_without_password}=updated_team_member

        res.status(200).json(team_member_without_password)

    }catch(err){
        console.log(err)
        if (err.message?.startsWith('Profile photo')) {
            return res.status(400).json({ message: err.message })
        }
        return res.status(500).json({message:'Error While Updating Team Member', error: err.message})
    }
}

const Delete_Team_Member=async (req,res)=>{
    try{

        const {id}=req.params

        const team_member=await Team_MemberRepository.findOneBy({id})

        if(!team_member){
            return res.status(404).json({message:'Team Member Not Found'})
        }

        if (!team_member.is_active) {
            return res.status(400).json({message: 'Team Member is already deactivated'});
        }

        team_member.is_active=false
        await Team_MemberRepository.save(team_member)

        res.status(200).json({message:`${team_member.name} has deactivated successfully`})

    }catch(err){
        console.log(err)
        return res.status(500).json({message: 'Error While Deactivating Team Member', error: err.message})
    }
}

const Activate_Team_Member=async (req,res)=>{
    try{

        const {id}=req.params

        const team_member=await Team_MemberRepository.findOneBy({id})

        if(!team_member){
            return res.status(404).json({message:'Team Member Not Found'})
        }

        if (team_member.is_active) {
            return res.status(400).json({message: 'Team Member is already active'});
        }

        team_member.is_active=true
        await Team_MemberRepository.save(team_member)

        res.status(200).json({message:`${team_member.name} has activated successfully`})

    }catch(err){
        console.log(err)
        return res.status(500).json({message: 'Error While Activating Team Member', error: err.message})
    }
}

module.exports={Create_Team_Member,Get_Team_Member,Update_Team_Member,Delete_Team_Member,Activate_Team_Member}

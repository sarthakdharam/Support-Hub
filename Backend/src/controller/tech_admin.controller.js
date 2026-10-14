const {Tech_AdminRepository}=require('../repositories/tech_admin.repository')
const {Super_AdminRepository}=require('../repositories/super_admin.repository')
const {Team_MemberRepository}=require('../repositories/team_member.repository')
const bcrypt=require('bcrypt')
const { Not } = require('typeorm')


const Create_Tech_Admin=async (req,res)=>{
    try{

        const {username,name,email,phone,password,branch,address}=req.body

        if (typeof username !== 'string' ||
            typeof name !== 'string' ||
            typeof email !== 'string' ||
            typeof phone !== 'string' ||
            typeof password !== 'string' ||
            typeof branch !== 'string' ||
            typeof address !== 'string'
        ) {
            return res.status(400).json({
                message: 'All fields are required'
            })
        }

        if(username.trim()===''){
            return res.status(400).json({message:'Enter username'})
        }

        if(name.trim()===''){
            return res.status(400).json({message:'Enter name'})
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
            return res.status(400).json({message:'Enter phone no.'})
        }else if(!/^\d{10}$/.test(phone)){
            return res.status(400).json({message:'phone no. should be of 10 digit'})
        }

        if(password.trim()===''){
            return res.status(400).json({message:'Enter password'})
        }else{
            const passwordvalid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=])[A-Za-z\d@$!%*?&#^()_+\-=]{8,}$/

            if (!passwordvalid.test(password.trim())) {
                return res.status(400).json({message:`use 8+ character with Uppercase,Lowercase,Number and Special Character`})
            }
        }

        if(branch.trim()===''){
            return res.status(400).json({message:'Enter branch'})
        }

        if(address.trim()===''){
            return res.status(400).json({message:'Enter address'})
        }
        

        const super_admin=await Super_AdminRepository.findOneBy({username:username})
        const team_member=await Team_MemberRepository.findOne({where:[{username:username},{email:email},{phone:phone}]})
        const tech_admin= await Tech_AdminRepository.findOne({where:[{username:username},{email:email},{phone:phone},{branch:branch}]})


        if(super_admin || team_member || tech_admin){
            console.log('username is already exists')
            return res.status(409).json({
                message:'Username, email, phone number, or branch already exists'
            })
        }

        const hashPassword = await bcrypt.hash(password,10)

        const tech_admins=Tech_AdminRepository.create({
            username,
            name,
            email,
            phone,
            password:hashPassword,
            branch,
            address
        })

        const save_tech_admin=await Tech_AdminRepository.save(tech_admins)
        const { password:_ , ...tech_adminWithoutPassword } = save_tech_admin
        return res.status(201).json(tech_adminWithoutPassword)       

    }catch(err){
        console.log(err)
        return res.status(500).json({message:'Error While Creating Tech Admin', error: err.message})
    }
}

const Get_Tech_Admin=async (req,res)=>{
    try{

        const tech_admin=await Tech_AdminRepository.find({
            select:{
                id:true,
                username:true,
                name:true,
                email:true,
                phone:true,
                branch:true,
                address:true,
                is_active:true,
                profile_photo:true,                
            },
            order:{
                id:'ASC'
            }
        })
        res.status(200).json(tech_admin)
        
    }catch(err){
        console.log(err)
        return res.status(500).json({message:'Error While Getting Tech Admin', error: err.message})
    }
}

const Update_Tech_Admin=async (req,res)=>{
    try{

        const tech_admin_id=req.user.userId

        const tech_admin=await Tech_AdminRepository.findOneBy({id:tech_admin_id})
        
        if(!tech_admin){
            return res.status(404).json({message:'Tech Admin Not Found'})
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
            const [team_member, other_admin] = await Promise.all([
                Team_MemberRepository.findOne({ where: conditions }),
                Tech_AdminRepository.findOne({
                    where: conditions.map(c => ({ ...c, id: Not(tech_admin.id) }))
                })
            ])

            if (team_member || other_admin) {
                return res.status(409).json({ message: 'Email or phone number already exists' })
            }
        }



        if(name) tech_admin.name=name
        if(new_email) tech_admin.email=new_email
        if(new_phone) tech_admin.phone=new_phone
        if(password) {
            tech_admin.password=await bcrypt.hash(password, 10)
        }
        if(address) tech_admin.address=address
        if(req.file){
            tech_admin.profile_photo=req.file.buffer
            tech_admin.profile_photo_mime=req.file.mimetype
        }

        const updated_tech_admin=await Tech_AdminRepository.save(tech_admin)
        const {password: _, ...tech_admin_without_password}=updated_tech_admin

        res.status(200).json(tech_admin_without_password)

    }catch(err){
        console.log(err)
        return res.status(500).json({message:'Error While Updating Tech Admin', error: err.message})
    }
}

const Delete_Tech_Admin=async (req,res)=>{
    try{

        const {id}=req.params

        const tech_admin=await Tech_AdminRepository.findOneBy({id})

        if(!tech_admin){
            return res.status(404).json({message:'Tech Admin Not Found'})
        }

        tech_admin.is_active=false
        await Tech_AdminRepository.save(tech_admin)

        res.status(200).json({message:`${tech_admin.name} has deactivated successfully`})

    }catch(err){
        console.log(err)
        return res.status(500).json({message:'Error While Updating Tech Admin', error: err.message})
    }
}

const Activate_Tech_Admin=async (req,res)=>{
    try{

        const {id}=req.params

        const tech_admin=await Tech_AdminRepository.findOneBy({id})

        if(!tech_admin){
            return res.status(404).json({message:'Tech Admin Not Found'})
        }

        tech_admin.is_active=true
        await Tech_AdminRepository.save(tech_admin)

        res.status(200).json({message:`${tech_admin.name} has activated successfully`})

    }catch(err){
        console.log(err)
        return res.status(500).json({message:'Error While Updating Tech Admin', error: err.message})
    }
}

module.exports={Create_Tech_Admin,Get_Tech_Admin,Update_Tech_Admin,Delete_Tech_Admin,Activate_Tech_Admin}
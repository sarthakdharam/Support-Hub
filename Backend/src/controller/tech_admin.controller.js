const {Tech_AdminRepository}=require('../repositories/tech_admin.repository')
const {Super_AdminRepository}=require('../repositories/super_admin.repository')
const {Team_MemberRepository}=require('../repositories/team_member.repository')
const bcrypt=require('bcrypt')


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
            return res.status(400).json({message:'there should be username'})
        }

        if(name.trim()===''){
            return res.status(400).json({message:'there should be name'})
        }

        if(email.trim()===''){
            return res.status(400).json({message:'there should be email'})
        }else{
            const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

            if (!emailPattern.test(email.trim())) {
                return res.status(400).json({message:'Enter Valid Email'})
            }
        }

        if(phone.trim()===''){
            return res.status(400).json({message:'there should be phone no.'})
        }else if(!/^\d{10}$/.test(phone)){
            return res.status(400).json({message:'phone no. should be of 10 digit'})
        }

        if(password.trim()===''){
            return res.status(400).json({message:'there should be password'})
        }else{
            const passwordvalid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=])[A-Za-z\d@$!%*?&#^()_+\-=]{8,}$/

            if (!passwordvalid.test(password.trim())) {
                return res.status(400).json({message:`use 8+ character with Uppercase,Lowercase,Number and Special Character`})
            }
        }

        if(branch.trim()===''){
            return res.status(400).json({message:'there should be branch'})
        }

        if(address.trim()===''){
            return res.status(400).json({message:'there should be address'})
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
        return res.status(500).json({message:'Error Creating User', error: err.message})
    }
}

module.exports={Create_Tech_Admin}
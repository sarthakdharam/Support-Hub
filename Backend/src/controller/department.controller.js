
const {DepartmentRepository}=require('../repositories/department.repository')




const Create_Department=async (req,res)=>{
    try{

        const {dept_name,Responsibilities}=req.body
        
        if (typeof dept_name !== 'string' ||
            typeof Responsibilities !== 'string'
        ) {
            return res.status(400).json({
                message: 'All fields are required'
            })
        }

        const clean_dept_name = dept_name.trim();
        const clean_Responsibilities = Responsibilities.trim();

        if(clean_dept_name===''){
            return res.status(400).json({message:'Enter Department Name'})
        }

        if(clean_Responsibilities===''){
            return res.status(400).json({message:'Enter Responsibilities'})
        }
        

        const department=await DepartmentRepository.findOneBy({dept_name:clean_dept_name})
        

        if(department){
            console.log('department is already exists')
            return res.status(409).json({
                message:'department name is  already exists'
            })
        }

        const departments=DepartmentRepository.create({
            dept_name:clean_dept_name,
            Responsibilities:clean_Responsibilities
        })

        const save_department=await DepartmentRepository.save(departments)
        return res.status(201).json(save_department)       

    }catch(err){
        console.log(err)
        return res.status(500).json({message:'Error While Creating Department', error: err.message})
    }
}

const Get_Department=async (req,res)=>{
    try{

        const role=req.user.role
        let department
        if(role==='super_admin'){
            department=await DepartmentRepository.find({
                select:{
                    id:true,
                    dept_name:true,
                    is_active:true,
                    Responsibilities:true
                },
                order:{
                    dept_name:'ASC'
                }
            })
        }else if(role==='tech_admin'){
            department=await DepartmentRepository.find({
                select:{
                    id:true,
                    dept_name:true,
                    is_active:true,
                    Responsibilities:true
                },
                where:{
                    is_active:true
                },
                order:{
                    dept_name:'ASC'
                }
            })
        }else {
            return res.status(403).json({message: 'Access denied'});
        }
        return res.status(200).json(department)

        
    }catch(err){
        console.log(err)
        return res.status(500).json({message:'Error While Getting Departments', error: err.message})
    }
}

const Delete_Department=async (req,res)=>{
    try{

        const {id}=req.params

        const department=await DepartmentRepository.findOneBy({id})

        if(!department){
            return res.status(404).json({message:'Department Not Found'})
        }

        if (!department.is_active) {
            return res.status(400).json({message: 'Department is already deactivated'});
        }

        department.is_active=false
        await DepartmentRepository.save(department)

        res.status(200).json({message:`${department.dept_name} has been deactivated successfully`})

    }catch(err){
        console.log(err)
        return res.status(500).json({message:'Error While Deactivating Department', error: err.message})
    }
}

const Activate_Department=async (req,res)=>{
    try{

        const {id}=req.params

        const department=await DepartmentRepository.findOneBy({id})

        if(!department){
            return res.status(404).json({message:'Department Not Found'})
        }

        if (department.is_active) {
            return res.status(400).json({message: 'Department is already active'});
        }

        department.is_active=true
        await DepartmentRepository.save(department)

        res.status(200).json({message:`${department.dept_name} has been activated successfully`})

    }catch(err){
        console.log(err)
        return res.status(500).json({message:'Error While Activating Department', error: err.message})
    }
}

module.exports={Create_Department,Get_Department,Delete_Department,Activate_Department}
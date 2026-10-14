const {Super_AdminRepository}=require('../repositories/super_admin.repository')
const {Team_MemberRepository}=require('../repositories/team_member.repository')
const {Tech_AdminRepository}=require('../repositories/tech_admin.repository')
const bcrypt=require('bcrypt')
const jwt=require('jsonwebtoken')


async function login(req,res){
    try{
        const {username,password}=req.body

        if (typeof username !== 'string' || typeof password !== 'string') {
            return res.status(400).json({
                message: 'All fields are required'
            })
        }

        if(username.trim()===''){
            return res.status(400).json({message:'Enter Username'})
        }
        if(password===''){
            return res.status(400).json({message:'Enter Password'})
        }
//***************************************************/ 
// SUPER ADMIN LOGIN CODE
// **************************************************/        
        const super_admin = await Super_AdminRepository.findOne({
            where:{ username:username },
            select:{ id:true, username:true, password:true }
        });
        if (super_admin) {
            //PASSWORD COMPARE
            const isMatch = await bcrypt.compare(password,super_admin.password)
            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid username or password' });
            }
            // Access Token Based on JWT
            const accessToken=jwt.sign(
                {
                    userId:super_admin.id,
                    role:'super_admin'
                },
                process.env.JWT_SECRET,
                {
                    expiresIn:'15m'
                }
            )
            // Refresh Token Based On JWT
            const refreshToken=jwt.sign(
                {
                    userId:super_admin.id,
                    role:'super_admin'
                },
                process.env.REFRESH_SECRET,
                {
                    expiresIn:'7d'
                }
            )    
            return res.status(200).json({ message: `${username} login successfully`, role: 'SUPER_ADMIN' ,accessToken :accessToken, refreshToken:refreshToken});
        }
//***************************************************/ 
// TECH ADMIN LOGIN CODE
// **************************************************/        

        const tech_admin = await Tech_AdminRepository.findOne({
            where:{ username },
            select:{ id:true, username:true, password:true, name:true, email:true, branch:true ,is_active:true,address:true,}
        })
        if(tech_admin){
            if(!tech_admin.is_active){
                return res.status(403).json({message:'This account has been deactivated'})
            }
            //PASSWORD COMPARE
            const isMatch = await bcrypt.compare(password,tech_admin.password)
            if(!isMatch){
                return res.status(401).json({ message: 'Invalid username or password' });
            }
            // Access Token Based on JWT
            const accessToken=jwt.sign(
                {
                    userId:tech_admin.id,
                    role:'tech_admin'
                },
                process.env.JWT_SECRET,
                {
                    expiresIn:'15m'
                }
            )
            // Refresh Token Based On JWT
            const refreshToken=jwt.sign(
                {
                    userId:tech_admin.id,
                    role:'tech_admin'
                },
                process.env.REFRESH_SECRET,
                {
                    expiresIn:'7d'
                })
            return res.status(200).json({message:`${username} login successfully`, role:'TECH_ADMIN',accessToken:accessToken,refreshToken:refreshToken})
        }
//***************************************************/ 
// TEAM MEMBER LOGIN CODE
// **************************************************/
        const team_member = await Team_MemberRepository.findOne({
            where:{ username },
            select:{ id:true, username:true, password:true, name:true, email:true, phone:true,is_active:true ,address:true}
        });
        if(team_member){
            if(!team_member.is_active){
                return res.status(403).json({message:'This account has been deactivated'})
            }
            //PASSWORD COMPARE
            const isMatch= await bcrypt.compare(password , team_member.password)
            if(!isMatch){
                return res.status(401).json({ message: 'Invalid username or password' });
            }
            // Access Token Based on JWT
            const accessToken=jwt.sign(
                {
                    userId:team_member.id,
                    role:'team_member'
                },
                process.env.JWT_SECRET,
                {
                    expiresIn:'15m'
                }
            )
            // Refresh Token Based On JWT
            const refreshToken=jwt.sign(
                {
                    userId:team_member.id,
                    role:'team_member'
                },
                process.env.REFRESH_SECRET,
                {
                    expiresIn:'7d'
                })
            return res.status(200).json({message:`${username} login successfully`, role:'TEAM_MEMBER',accessToken:accessToken,refreshToken:refreshToken})
        }

        return res.status(401).json({ message: 'Invalid username or password' });
    }catch(err){
        console.log(err)
        return res.status(500).json({message:`server error`})
    }
}
module.exports={login}
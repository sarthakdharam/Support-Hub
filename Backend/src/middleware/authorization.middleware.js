function authorize(AllowedRoles){
    return (req,res,next)=>{
        if(!req.user){
            return res.ststus(401).json({message:'Not Authenticated'})
        }
        if(!AllowedRoles.includes(req.user.role)){
            return res.status(403).json({message:'Access denied: Not have permission'})
        }
        next()
    }
}
module.exports={authorize}
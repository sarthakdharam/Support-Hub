const {Super_AdminRepository}=require('../repositories/super_admin.repository')
const bcrypt = require('bcrypt');

async function seedSuper_Admin() {
    

    const existingAdmin = await Super_AdminRepository.findOneBy({ username: 'admin' });
    if (existingAdmin) {
        console.log('Super_Admin already exists, skipping seed');
        return;
    }

    const hashedPassword = await bcrypt.hash('admin123', 10);

    const admin = Super_AdminRepository.create({
        username: 'admin',
        password: hashedPassword,
    });

    await Super_AdminRepository.save(admin);
    console.log('Super_Admin seeded successfully');
}

module.exports = { seedSuper_Admin };
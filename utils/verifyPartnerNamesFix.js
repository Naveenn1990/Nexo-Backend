const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nexo', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const partnerSchema = new mongoose.Schema({}, { strict: false });
const Partner = mongoose.model('Partner', partnerSchema);

async function verifyPartnerNamesFix() {
    try {
        console.log('Verifying partner names fix...');
        
        // Get all partners and show their names
        const partners = await Partner.find({})
            .select('_id profile.name phone')
            .sort({ 'profile.name': 1 })
            .limit(20);
        
        console.log(`\nShowing first 20 partners (sorted by name):`);
        console.log('='.repeat(60));
        
        partners.forEach((partner, index) => {
            console.log(`${index + 1}. ${partner.profile?.name || 'NO NAME'} | Phone: ${partner.phone || 'NO PHONE'}`);
        });
        
        // Check for any remaining problematic names
        console.log('\n=== Checking for remaining issues ===');
        
        const problematicNames = await Partner.find({
            $or: [
                { 'profile.name': { $regex: /\d{7,}/ } }, // Names with 7+ consecutive digits
                { 'profile.name': { $regex: /Service Partner\d/ } }, // Names like "Service PartnerXXXX"
                { 'profile.name': null },
                { 'profile.name': '' }
            ]
        });
        
        if (problematicNames.length > 0) {
            console.log(`Found ${problematicNames.length} partners with potential issues:`);
            problematicNames.forEach(partner => {
                console.log(`- ${partner._id}: "${partner.profile?.name || 'NO NAME'}"`);
            });
        } else {
            console.log('✅ No problematic partner names found!');
        }
        
        // Show summary statistics
        const totalPartners = await Partner.countDocuments();
        const partnersWithNames = await Partner.countDocuments({ 'profile.name': { $exists: true, $ne: null, $ne: '' } });
        
        console.log('\n=== Summary ===');
        console.log(`Total partners: ${totalPartners}`);
        console.log(`Partners with names: ${partnersWithNames}`);
        console.log(`Partners without names: ${totalPartners - partnersWithNames}`);
        
        console.log('\n✅ Partner names verification completed!');
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
}

verifyPartnerNamesFix();
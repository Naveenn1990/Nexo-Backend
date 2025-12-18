const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nexo', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const partnerSchema = new mongoose.Schema({}, { strict: false });
const Partner = mongoose.model('Partner', partnerSchema);

// Validation functions
const isValidName = (name) => {
    if (!name || typeof name !== 'string') return false;
    const cleanName = name.trim();
    if (cleanName.length === 0 || cleanName.length > 50) return false;
    // Check for Lorem Ipsum or corrupted patterns
    if (/lorem|ipsum|dolor|sit|amet|consectetur|adipiscing|elit|eos|est|accusantium|quia|incididunt|dolorem/i.test(cleanName)) return false;
    return true;
};

const isValidPhone = (phone) => {
    if (!phone || typeof phone !== 'string') return false;
    const cleanPhone = phone.trim();
    if (cleanPhone.length === 0 || cleanPhone.length > 20) return false;
    // Must contain at least one digit
    if (!/\d/.test(cleanPhone)) return false;
    // Check for Lorem Ipsum or corrupted patterns
    if (/lorem|ipsum|dolor|sit|amet|consectetur|adipiscing|elit|eos|est|accusantium/i.test(cleanPhone)) return false;
    return true;
};

const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    const cleanEmail = email.trim();
    if (cleanEmail.length === 0 || cleanEmail.length > 100) return false;
    // Must contain @ symbol
    if (!cleanEmail.includes('@')) return false;
    // Check for Lorem Ipsum or corrupted patterns
    if (/lorem|ipsum|dolor|sit|amet|consectetur|adipiscing|elit|eos|est|accusantium/i.test(cleanEmail)) return false;
    return true;
};

async function validatePartnerData() {
    try {
        console.log('Starting partner data validation...');
        
        const partners = await Partner.find({});
        console.log(`Validating ${partners.length} partners...`);
        
        const issues = [];
        
        for (const partner of partners) {
            const partnerIssues = [];
            
            // Validate profile.name
            if (partner.profile && partner.profile.name) {
                if (!isValidName(partner.profile.name)) {
                    partnerIssues.push(`Invalid name: "${partner.profile.name}"`);
                }
            } else {
                partnerIssues.push('Missing profile name');
            }
            
            // Validate phone numbers
            let hasValidPhone = false;
            if (partner.profile && partner.profile.phone) {
                if (isValidPhone(partner.profile.phone)) {
                    hasValidPhone = true;
                } else {
                    partnerIssues.push(`Invalid profile phone: "${partner.profile.phone}"`);
                }
            }
            
            if (partner.phone) {
                if (isValidPhone(partner.phone)) {
                    hasValidPhone = true;
                } else {
                    partnerIssues.push(`Invalid direct phone: "${partner.phone}"`);
                }
            }
            
            if (!hasValidPhone) {
                partnerIssues.push('No valid phone number found');
            }
            
            // Validate email
            if (partner.profile && partner.profile.email) {
                if (!isValidEmail(partner.profile.email)) {
                    partnerIssues.push(`Invalid email: "${partner.profile.email}"`);
                }
            }
            
            if (partnerIssues.length > 0) {
                issues.push({
                    partnerId: partner._id,
                    issues: partnerIssues
                });
            }
        }
        
        if (issues.length > 0) {
            console.log(`\nFound ${issues.length} partners with data issues:`);
            issues.forEach(issue => {
                console.log(`\nPartner ${issue.partnerId}:`);
                issue.issues.forEach(i => console.log(`  - ${i}`));
            });
        } else {
            console.log('All partner data is valid!');
        }
        
        console.log(`\nValidation completed. ${partners.length - issues.length}/${partners.length} partners have valid data.`);
        
    } catch (error) {
        console.error('Error during validation:', error);
    } finally {
        mongoose.connection.close();
    }
}

// Run the validation
validatePartnerData();
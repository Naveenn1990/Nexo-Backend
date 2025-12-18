// Middleware to validate and clean partner data before saving

const validatePartnerData = (req, res, next) => {
    if (req.body && req.body.profile) {
        // Clean and validate name
        if (req.body.profile.name) {
            const name = req.body.profile.name.trim();
            
            // Check for corrupted patterns
            if (name.length > 50 || 
                /lorem|ipsum|dolor|sit|amet|consectetur|adipiscing|elit|eos|est|accusantium|quia|incididunt|dolorem/i.test(name)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid name format. Please provide a valid partner name.'
                });
            }
            
            req.body.profile.name = name;
        }
        
        // Clean and validate phone
        if (req.body.profile.phone) {
            const phone = req.body.profile.phone.trim();
            
            // Check for corrupted patterns
            if (phone.length > 20 || 
                /lorem|ipsum|dolor|sit|amet|consectetur|adipiscing|elit|eos|est|accusantium/i.test(phone) ||
                !/\d/.test(phone)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid phone format. Please provide a valid phone number.'
                });
            }
            
            req.body.profile.phone = phone;
        }
        
        // Clean and validate email
        if (req.body.profile.email) {
            const email = req.body.profile.email.trim();
            
            // Check for corrupted patterns
            if (email.length > 100 || 
                /lorem|ipsum|dolor|sit|amet|consectetur|adipiscing|elit|eos|est|accusantium/i.test(email) ||
                !email.includes('@')) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid email format. Please provide a valid email address.'
                });
            }
            
            req.body.profile.email = email;
        }
    }
    
    // Clean direct phone field if present
    if (req.body.phone) {
        const phone = req.body.phone.trim();
        
        // Check for corrupted patterns
        if (phone.length > 20 || 
            /lorem|ipsum|dolor|sit|amet|consectetur|adipiscing|elit|eos|est|accusantium/i.test(phone) ||
            !/\d/.test(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone format. Please provide a valid phone number.'
            });
        }
        
        req.body.phone = phone;
    }
    
    next();
};

module.exports = { validatePartnerData };
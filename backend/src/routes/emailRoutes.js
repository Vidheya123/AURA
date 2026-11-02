const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const { Resend } = require("resend");

const router = express.Router();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    }
);

const resend = new Resend(process.env.RESEND_API_KEY);

router.post("/login-notification", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                error: "Missing authentication token",
            });
        }

        const accessToken = authHeader.replace("Bearer ", "");

        // Verify the logged-in user with Supabase
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser(accessToken);

        if (userError || !user) {
            return res.status(401).json({
                error: "Invalid or expired authentication token",
            });
        }

        const email = user.email;

        if (!email) {
            return res.status(400).json({
                error: "User does not have an email address",
            });
        }

        const loginTime = new Date().toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            dateStyle: "medium",
            timeStyle: "short",
        });

        const { data, error } = await resend.emails.send({
            from: "AURA Security <onboarding@resend.dev>",
            to: [email],
            subject: "New sign-in to your AURA account",
            html: `
                <div style="
                    font-family: Arial, sans-serif;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 30px;
                    color: #222;
                ">
                    <h1 style="margin-bottom: 10px;">
                        New sign-in to AURA
                    </h1>

                    <p>
                        Your AURA account was just signed in to successfully.
                    </p>

                    <div style="
                        background: #f5f5f5;
                        padding: 20px;
                        border-radius: 10px;
                        margin: 20px 0;
                    ">
                        <p>
                            <strong>Time:</strong> ${loginTime}
                        </p>

                        <p>
                            <strong>Sign-in method:</strong> Email & Password
                        </p>
                    </div>

                    <p>
                        If this was you, no action is required.
                    </p>

                    <p>
                        If you don't recognize this sign-in,
                        please change your password immediately.
                    </p>

                    <hr style="margin: 25px 0;" />

                    <p style="font-size: 13px; color: #777;">
                        This is an automated security notification from AURA.
                    </p>
                </div>
            `,
        });

        if (error) {
            console.error("Resend error:", error);

            return res.status(500).json({
                error: "Failed to send login notification",
            });
        }

        console.log(`Login notification sent to ${email}`);

        return res.status(200).json({
            success: true,
            message: "Login notification sent",
            emailId: data?.id,
        });

    } catch (error) {
        console.error("Login notification error:", error);

        return res.status(500).json({
            error: "Internal server error",
        });
    }
});

module.exports = router;
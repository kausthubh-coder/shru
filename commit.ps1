# PowerShell script to auto commit and push to GitHub

# Prompt for commit message
$msg = Read-Host "Enter commit message"

# Navigate to your Git repo directory (optional, replace with your path)
# Set-Location "C:\path\to\your\repo"

# Stage all changes
git add .

# Commit with the provided message
git commit -m "$msg"

# Push to the default remote and branch
git push

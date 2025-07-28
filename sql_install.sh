url https://packages.microsoft.com/keys/microsoft.asc | sudo gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg

# Obtain the configuration for the repositories and add it to the system.
curl https://packages.microsoft.com/config/ubuntu/$(lsb_release -rs)/prod.list | sudo tee /etc/apt/sources.list.d/mssql-release.list

# Update package lists
sudo apt update

# Install MSSQL ODBC driver version 18
sudo ACCEPT_EULA=Y apt-get install -y msodbcsql18
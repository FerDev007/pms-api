FROM python:3.13-alpine

# Install system dependencies
RUN apk add --no-cache \
    gcc \
    g++ \
    musl-dev \
    unixodbc-dev \
    mariadb-connector-c \
    sudo \
    gpg \
    curl \
    make \
    net-snmp-tools


# Set the working directory
WORKDIR /app

# Download SQL Server drivers (modify script as needed)
COPY install_sql_server18_alpine_driver.sh .

# Make the script executable and run it
RUN chmod +x install_sql_server18_alpine_driver.sh && ./install_sql_server18_alpine_driver.sh

# Copy the requirements file
COPY requirements.txt .

# Install dependencies in a virtual environment
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Create user and group
RUN addgroup app && adduser -S -G app app

# Set ownership to the app user of the working directory
RUN chown -R app:app /app

# Switch to the app user
USER app

# Exponer el puerto
EXPOSE 8002

# Punto de entrada
ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]

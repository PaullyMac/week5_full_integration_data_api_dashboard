# backend-laravel/Dockerfile
FROM php:8.2-apache

# system deps
RUN apt-get update && apt-get install -y git unzip libzip-dev libpq-dev \
 && rm -rf /var/lib/apt/lists/*

# PHP extensions
RUN docker-php-ext-install zip pdo pdo_pgsql

# Apache: serve public/ and enable rewrite
RUN a2enmod rewrite \
 && sed -ri 's!/var/www/html!/var/www/html/public!g' /etc/apache2/sites-available/000-default.conf

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Workdir and copy app code from your repo
WORKDIR /var/www/html
COPY . .

# Install PHP deps (prod flags)
RUN composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

# Ensure Laravel can write caches/logs
RUN mkdir -p storage/framework/{cache,sessions,views} storage/logs \
 && chown -R www-data:www-data storage bootstrap/cache \
 && chmod -R 775 storage bootstrap/cache

EXPOSE 80
CMD ["apache2-foreground"]

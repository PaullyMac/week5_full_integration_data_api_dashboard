FROM php:8.2-apache
RUN apt-get update && apt-get install -y git unzip libzip-dev libpq-dev && rm -rf /var/lib/apt/lists/*
RUN docker-php-ext-install zip pdo pdo_pgsql
RUN a2enmod rewrite \
 && sed -ri 's!/var/www/html!/var/www/html/public!g' /etc/apache2/sites-available/000-default.conf
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /var/www/html
RUN test -f artisan || composer create-project --prefer-dist laravel/laravel . \
 && php artisan key:generate || true
EXPOSE 80
CMD ["apache2-foreground"]

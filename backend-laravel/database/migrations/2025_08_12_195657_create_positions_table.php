<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('positions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('traccar_id')->unique();
            $table->unsignedBigInteger('device_id')->index();
            $table->timestampTz('fix_time')->nullable()->index();
            $table->timestampTz('server_time')->nullable()->index();
            $table->decimal('latitude', 9, 6)->nullable();
            $table->decimal('longitude', 10, 6)->nullable();
            $table->decimal('altitude', 8, 2)->nullable();
            $table->decimal('speed', 8, 2)->nullable();
            $table->integer('course')->nullable();
            $table->boolean('valid')->default(true);
            $table->text('address')->nullable();
            $table->json('attributes')->nullable();
            $table->timestamps();
            $table->index(['device_id','fix_time']);
        });
    }
    public function down(): void { Schema::dropIfExists('positions'); }
};

<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Position extends Model
{
    protected $fillable = [
        "traccar_id","device_id","fix_time","server_time",
        "latitude","longitude","altitude","speed","course",
        "valid","address","attributes",
    ];
    protected $casts = [
        "fix_time"   => "datetime",
        "server_time"=> "datetime",
        "latitude"   => "float",
        "longitude"  => "float",
        "altitude"   => "float",
        "speed"      => "float",
        "valid"      => "boolean",
        "attributes" => "array",
    ];
}

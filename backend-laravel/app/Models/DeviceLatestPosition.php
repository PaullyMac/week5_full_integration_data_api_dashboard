<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeviceLatestPosition extends Model
{
    protected $table = "device_latest_positions";
    public $timestamps = true;
    protected $primaryKey = "device_id";
    public $incrementing = false;
    protected $fillable = [
        "device_id","last_traccar_id","fix_time",
        "latitude","longitude","altitude","speed","course",
        "valid","address","attributes",
    ];
    protected $casts = [
        "fix_time"   => "datetime",
        "latitude"   => "float",
        "longitude"  => "float",
        "altitude"   => "float",
        "speed"      => "float",
        "valid"      => "boolean",
        "attributes" => "array",
    ];
}

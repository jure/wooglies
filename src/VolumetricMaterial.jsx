import { extend } from 'react-three-fiber'
import { shaderMaterial } from '@react-three/drei'
import * as THREE from 'three'

const VolumetricMaterial = shaderMaterial(
  {
    // All quats are vec4 until UniformsUtils.clone
    // is fixed https://github.com/mrdoob/three.js/pull/21268
    localCameraPos: new THREE.Vector3(),
    cameraPos: new THREE.Vector3(),
    cameraQuat: new THREE.Quaternion(),
    iTime: 0,
    iFrame: 0,
    audioModifier: 0,
    frequencies: Array(32).fill(),
    leftControllerPos: new THREE.Vector3(0, 100, 100),
    rightControllerPos: new THREE.Vector3(0, 100, 100),
    leftControllerQuat: new THREE.Vector4(),
    rightControllerQuat: new THREE.Vector4(),
    wooglyPos: new THREE.Vector3(), // Woogly is the woogly thingy/head
    wooglyQuat: new THREE.Vector4(0, 0, 0, 1),
    lightOne: new THREE.Vector3(6, -5, 1),
    lightTwo: new THREE.Vector3(-3, 1, 1),
    lightThree: new THREE.Vector3(-1, 1, -2),
    worldDirection: new THREE.Vector3(),
    zFar: 100,
    zNear: 1,
    objectQuat: new THREE.Vector4(),
    // headRotation: new THREE.Quaternion(),
  },
  `
varying vec2 vUv;
out vec3 vPosition;

void main()	{
  vUv = uv;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  vPosition = position;
}
`,
  `
  // Modified for VR and audio reactivity by Jure Triglav
  // Thank you for letting me reuse your shader, Leon Denise! 
  // Original shader author: https://www.shadertoy.com/view/3ltyRB

  // Leon Denise 2020.12.31
  // 
  // thanks to Inigo Quilez, Dave Hoskins, Koltes, NuSan
  // for sharing useful lines of code
  //
  // Licensed under hippie love conspiracy

  uniform float iTime;
  uniform vec3 localCameraPos;
  varying vec3 vPosition;
  uniform vec3 cameraPos;
  uniform float audioModifier;
  uniform uint iFrame;
  uniform float frequencies[32];
  uniform vec3 wooglyPos;
  uniform vec4 wooglyQuat;
  uniform vec3 leftControllerPos;
  uniform vec3 rightControllerPos;
  uniform vec4 leftControllerQuat;
  uniform vec4 rightControllerQuat;
  uniform vec3 lightOne;
  uniform vec3 lightTwo;
  uniform vec3 lightThree;
  uniform vec4 headRotation;
  uniform vec3 worldDirection;
  uniform float zFar;
  uniform float zNear;
  uniform vec4 objectQuat;
  in vec2 vUv;

  #define PI 3.141592653589793
  #define SUBSPHERE_COUNT 32
  #define MAINSPHERE vec4(0, 0, 0, 0.4)
 
  #define repeat(p,r) (mod(p+r/2.,r)-r/2.)

  // details about sdf volumes
  struct Volume
  {
      float dist;
      int mat;
      float density;
      float space;
  };
  
  // union operation between two volume
  Volume select(Volume a, Volume b)
  {
      if (a.dist < b.dist) return a;
      return b;
  }
  
  // materials
  const int mat_eye_globe = 1;
  const int mat_pupils = 2;
  const int mat_eyebrows = 3;
  const int mat_iris = 4;
  const int mat_glass = 5;
  
  // Rotation 2D matrix
  mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c,-s,s,c); }
  
  vec3 rotate_vector( vec4 quat, vec3 vec) {
    return vec + 2.0 * cross( cross( vec, quat.xyz ) + quat.w * vec, quat.xyz );
  }

  // Dave Hoskins
  // https://www.shadertoy.com/view/4djSRW
  float hash12(vec2 p)
  {
      vec3 p3 = fract(vec3(p.xyx) * .1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
  }

  // Integer Hash - III (modified with comment by Nimitz)
  // - Inigo Quilez, Integer Hash - III, 2017
  //   https://www.shadertoy.com/view/4tXyWN
  float iqint3(uvec2 x)
  {
      uvec2 q = 1103515245U * ( (x>>1U) ^ (x.yx   ) );
      uint  n = 1103515245U * ( (q.x  ) ^ (q.y>>3U) );
      n = n ^ (n>>16u); // finisher by Nimitz
      return float(n) * (1.0/float(0xffffffffU));
  }
  
  // Inigo Quilez
  // https://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm
  float sdBox( vec3 p, vec3 b )
  {
    vec3 q = abs(p) - b;
    return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
  }
  float opSmoothUnion( float d1, float d2, float k ) {
      float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
      return mix( d2, d1, h ) - k*h*(1.0-h); }
  
  float opSmoothSubtraction( float d1, float d2, float k ) {
      float h = clamp( 0.5 - 0.5*(d2+d1)/k, 0.0, 1.0 );
      return mix( d2, -d1, h ) + k*h*(1.0-h); }
  
  float opSmoothIntersection( float d1, float d2, float k ) {
      float h = clamp( 0.5 - 0.5*(d2-d1)/k, 0.0, 1.0 );
      return mix( d2, d1, h ) + k*h*(1.0-h); }
  float sdCappedTorus(in vec3 p, in vec2 sc, in float ra, in float rb)
  {
    p.x = abs(p.x);
    float k = (sc.y*p.x>sc.x*p.y) ? dot(p.xy,sc) : length(p.xy);
    return sqrt( dot(p,p) + ra*ra - 2.0*ra*k ) - rb;
  }
  float sdVerticalCapsule( vec3 p, float h, float r )
  {
    p.y -= clamp( p.y, 0.0, h );
    return length( p ) - r;
  }

  float sdCappedCone(vec3 p, vec3 a, vec3 b, float ra, float rb)
  {
      float rba  = rb-ra;
      float baba = dot(b-a,b-a);
      float papa = dot(p-a,p-a);
      float paba = dot(p-a,b-a)/baba;
      float x = sqrt( papa - paba*paba*baba );
      float cax = max(0.0,x-((paba<0.5)?ra:rb));
      float cay = abs(paba-0.5)-0.5;
      float k = rba*rba + baba;
      float f = clamp( (rba*(x-ra)+paba*baba)/k, 0.0, 1.0 );
      float cbx = x-ra - f*rba;
      float cby = paba - f;
      float s = (cbx < 0.0 && cay < 0.0) ? -1.0 : 1.0;
      return s*sqrt( min(cax*cax + cay*cay*baba,
                         cbx*cbx + cby*cby*baba) );
  }
  
  float sdRoundCone( vec3 p, float r1, float r2, float h )
  {
    vec2 q = vec2( length(p.xz), p.y );
      
    float b = (r1-r2)/h;
    float a = sqrt(1.0-b*b);
    float k = dot(q,vec2(-b,a));
      
    if( k < 0.0 ) return length(q) - r1;
    if( k > a*h ) return length(q-vec2(0.0,h)) - r2;
          
    return dot(q, vec2(a,b) ) - r1;
  }

  float sdRoundedCylinder( vec3 p, float ra, float rb, float h )
  {
    vec2 d = vec2( length(p.xz)-2.0*ra+rb, abs(p.y) - h );
    return min(max(d.x,d.y),0.0) + length(max(d,0.0)) - rb;
  }
  float sdRoundBox( vec3 p, vec3 b, float r )
  {
    vec3 q = abs(p) - b;
    return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0) - r;
  }  

  vec4[SUBSPHERE_COUNT] secondaries;
  
  bool ao_pass = false;
  
  vec3 GetSphericalFibonacciCoord(int ng, int index)
  {
    float phi = ( 1.0 + sqrt ( 5.0 ) ) / 2.0;
      
      float ngFloat = float(ng);
  
      float iFloat = float( - ng + 1 + 2 * index);
      float theta = 2.0 * PI * iFloat / phi;
      float sphi = iFloat / ngFloat;
      float cphi = sqrt ( ( ngFloat + iFloat ) * ( ngFloat - iFloat ) ) / ngFloat;
  
      return vec3(
          cphi * sin ( theta ),
          cphi * cos ( theta ),
      sphi);
  }
  
  // Hash from Dave_Hoskins
  #define HASHSCALE1 .1031
  float hash11(float p)
  {
    vec3 p3  = fract(vec3(p) * HASHSCALE1);
      p3 += dot(p3, p3.yzx + 19.19);
      return fract((p3.x + p3.y) * p3.z);
  }
  
  float Noise1D(float x)
  {
    float p = floor(x);
    float f = fract(x);
       f = f*f*(3.0-2.0*f);
  
    return mix(hash11(p), hash11(p+1.0), f);
  }
  
  // Smooth min function from IQ
  float smin( float a, float b, float k )
  {
      float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
      return mix( b, a, h ) - k*h*(1.0-h);
  }
  
  // volumes description
  Volume map(vec3 pos)
  {
      vec3 p = pos;
      Volume ghost;
      ghost.mat = 0;
      ghost.density = 0.05;
      ghost.space = 0.06;
      vec4 s = MAINSPHERE;

      // To match head/camera rotation
      vec3 rotPos = p - wooglyPos;
      rotPos = rotate_vector(wooglyQuat, rotPos);
      float sphereDist = length(rotPos)-s.w;
      float d=sphereDist;
        
      float sphere2Radius = 0.25;
      for(int i=0;i<SUBSPHERE_COUNT;i++)
        {
        vec4 secSpj = secondaries[i] ;
        float secondarySphereDist = length(rotPos - secSpj.xyz)-secSpj.w;
        d = smin(d, secondarySphereDist, .1);
        }
        

      float leftController = sdRoundCone(rotate_vector(leftControllerQuat, p - vec3(leftControllerPos)), .07, .14, .2);
      float rightController = sdRoundCone(rotate_vector(rightControllerQuat, p - vec3(rightControllerPos)), .07, .14, .2);

      d = smin(d, leftController, .1);
      d = smin(d, rightController, .1);

      ghost.dist = d;
      return ghost;
    
      // float shape = 100.;
  
      // // global twist animation
      // pos.zy *= rot(sin(pos.y*.2 + iTime) * .1 + .2);
      // pos.yx *= rot(0.1 * sin(pos.y * .3 + iTime));
      // vec3 p = pos;
  
      // Volume ghost;
      // ghost.mat = 0;
      // ghost.density = 0.05;
      // ghost.space = 0.12;
      
      // Volume opaque;
      // opaque.mat = 0;
      // opaque.density = 1.;
      // opaque.space = 0.;
      
      // Volume hair;
      // hair.mat = mat_eyebrows;
      // hair.density = .2;
      // hair.space = 0.1;
      
      // Volume glass;
      // glass.mat = mat_glass;
      // glass.density = .15;
      // glass.space = 0.1;
  
      // // head
      // ghost.dist = length(p*vec3(1,0.9,1))-1.0;
      // ghost.dist = opSmoothUnion(ghost.dist, length(p-vec3(0,1.2,0))-0.55, 0.35);
      
      // // mouth
      // p.z += 1.3;
      // p.yz *= rot(p.z * .5 + 0.1*sin(iTime+p.z*4.));
      // shape = sdBox(p, vec3(1,0.01,1.));
      // shape = max(shape, -length(pos.xz)+.99);
      // ghost.dist = opSmoothSubtraction(shape, ghost.dist, 0.1);
  
      // // hat
      // p = pos-vec3(0,1.6,0);
      // shape = sdRoundedCylinder(p + sin(p.z*4.)*.03, .4, .01, .01);
      // shape = min(shape, sdCappedCone(p+.05*sin(p.z*8.), vec3(0,.5,0), vec3(0), .3, .445));
      // //ghost.dist = min(ghost.dist, shape);
  
      // // eyes globes
      // p = pos-vec3(0,1.,-.55);
      // float s = sign(p.x);
      // p.xz *= rot(-pos.x*1.);
      // p.x = abs(p.x)-.15;
      // opaque.dist = max(length(p*vec3(1,1.,1.3))-0.18, -ghost.dist);
      // opaque.mat = mat_eye_globe;
  
      // // eyebrows
      // p -= vec3(0.05,.3,-.03);
      // p.y -= 0.01*sin(iTime*3.);
      // p.xy *= rot(0.2 + sin(pos.x * 2. + iTime)*.5);
      // shape = sdBox(p, vec3(.15,0.02-p.x*.1,.03));
      // hair.dist = shape;
  
      // // body
      // p = pos;
      // //ghost.dist = opSmoothUnion(ghost.dist, length(p+vec3(0,1.8,0))-.5, 0.6);
  
      // // legs
      // p.x = abs(p.x)-.2;
      // p.z += 0.1*sin(p.x*4. + iTime);
      // //ghost.dist = opSmoothUnion(ghost.dist, sdVerticalCapsule(p+vec3(0,2.8,0), 0.6, 0.01+max(0.,p.y+3.)*0.3), 0.2);
  
      // // arms
      // p = pos;
      // p.x = abs(p.x)-.4;
      // p.xy *= rot(3.14/2.);
      // p.x += pos.x*0.2*sin(pos.x + iTime);
      // ghost.dist = opSmoothUnion(ghost.dist, sdVerticalCapsule(p+vec3(-1.5,0,0), 0.6, 0.2), 0.2);
      
      // Volume volume = ghost; // select(select(ghost, opaque), hair);
  
      // // glass
      // if (!ao_pass)
      // {
      //     p = pos-vec3(0,1.,-.65);
      //     p.x = abs(p.x)-.18;
      //     glass.dist = sdRoundBox(p+vec3(-0.1,0,.1), vec3(0.2+p.y*0.1, 0.15+p.x*.05, 0.001), 0.05);
      //     glass.dist = max(glass.dist, -sdRoundBox(p+vec3(-0.1,0,.1), vec3(0.18+p.y*0.1, 0.14+p.x*.05, 0.1), 0.05));
      //     glass.dist = max(glass.dist, abs(p.z)-.1);
      //     volume = select(volume, glass);
      // }
  
      // return volume;
  }
  
  // NuSan
  // https://www.shadertoy.com/view/3sBGzV
  vec3 getNormal(vec3 p) {
    vec2 off=vec2(0.001,0);
    return normalize(map(p).dist-vec3(map(p-off.xyy).dist, map(p-off.yxy).dist, map(p-off.yyx).dist));
  }
  
  // Inigo Quilez
  // https://www.shadertoy.com/view/Xds3zN
  float getAO( in vec3 pos, in vec3 nor )
  {
    float occ = 0.0;
      float sca = 1.0;
      for( int i=0; i<5; i++ )
      {
          float h = 0.01 + 0.12*float(i)/4.0;
          Volume volume = map( pos + h*nor );
          float d = volume.dist;
          occ += (h-d)*sca;
          sca *= 0.95;
          if( occ>0.35 ) break;
      }
      return clamp( 1.0 - 3.0*occ, 0.0, 1.0 ) * (0.5+0.5*nor.y);
  }
  
  void main()
  {
  
      // Generage subsphere coordinates
      // https://www.shadertoy.com/view/wdjGDK by Gaxil
      for(int i=0;i<SUBSPHERE_COUNT;i++)
      {
      vec3 ssphPos = GetSphericalFibonacciCoord(SUBSPHERE_COUNT, i).xzy;
      float rndVal = Noise1D(float(i)*0.1+iTime*2.5+ssphPos.y);
      ssphPos *= (.2 + frequencies[31-i]*.8);
      secondaries[i] = vec4(ssphPos , mix(0.1, 0.15, rndVal));
      }
    
      // Custom
      vec3 pos = localCameraPos;
      vec3 ray = normalize(vPosition - localCameraPos);
      vec4 color = vec4(0,0,0,1);
      // End custom
      
      // background gradient
      //color.rgb += vec3(0.2235, 0.3804, 0.5882) * vUv.y;
      
      // render variables
      float shade = 0.0;
      vec3 normal = vec3(0,1,0);
      float ao = 0.0;
      uvec2 p = uvec2(vUv*2048.0) + 1920U*1080U*uint(iFrame);
      float rng = iqint3(p);
      
      // Noise test
      // gl_FragColor.r = rng;
      // gl_FragColor.a = 1.0;
      // return;
      // Noise test end

      float distance = 0.0;
      const int count = 30;
      gl_FragDepth = 1.0;

      // raymarch iteration
      for (int index = 0; index < count; ++index)
      {
          Volume volume = map(pos);
          if (volume.dist < 0.01)
          {
              // sample and depth ao when first hit
              if (shade < 0.001)
              {
                  ao_pass = true;
                  ao = getAO(pos, normal);
                  ao_pass = false;

                  // extract the z depth of our hit
                  // take object/box rotation into account too
                  vec3 rotatedRay = rotate_vector(objectQuat, ray);
                  float z = -distance * dot(worldDirection, rotatedRay);
                  // convert to normalized device coordinates
                  float ndcz = (zFar + zNear + (2.0*zFar*zNear)/z)
                            / (zFar - zNear);
                
                  // map onto gl_DepthRange
                  gl_FragDepth = 0.5 * (gl_DepthRange.diff * ndcz + gl_DepthRange.near + gl_DepthRange.far);
                  
                  
              }
              
              // accumulate fullness
              shade += volume.density;
              
              // step further on edge of volume
              normal = getNormal(pos);
              float fresnel = pow(dot(ray, normal)*.5+.5, 1.2);
              volume.dist = volume.space * fresnel;
              
              // coloring
              vec3 col = vec3(0);
              switch (volume.mat)
              {
                  // eye globes color
                  case mat_eye_globe:
                  float globe = dot(normal, vec3(0,1,0))*0.5+0.5;
                  vec3 look = vec3(0,0,-1);
                  look.xz *= rot(sin(iTime)*0.2-.2);
                  look.yz *= rot(sin(iTime*2.)*0.1+.5);
                  float pupils = smoothstep(0.01, 0.0, dot(normal, look)-.95);
                  col += vec3(1)*globe*pupils;
                  break;
  
                  // eyebrows color
                  case mat_eyebrows:
                  col += vec3(0.3451, 0.2314, 0.5255);
                  break;
  
                  // glass color
                  case mat_glass:
                  col += vec3(.2);
                  break;
  
                  // ghost color
                  default:
                  vec3 leftlight = normalize(lightOne);
                  vec3 rightlight = normalize(lightTwo);
                  vec3 frontlight = normalize(lightThree);
                  vec3 blue = vec3(0,0,1) * pow(dot(normal, leftlight)*0.5+0.5, 0.2);
                  vec3 green = vec3(0,1,0) * pow(dot(normal, frontlight)*0.5+0.5, 2.);
                  vec3 red = vec3(0.8941, 0.2039, 0.0824) * pow(dot(normal, rightlight)*0.5+0.5, .5);
                  col += blue + green + red;
                  col *= ao*0.5+0.3;
                  break;
              }
              
              // accumulate color
              color.rgb += col * volume.density;
          }
          
          // stop when fullness reached
          if (shade >=  1.0)
          {
              break;    
          }
          


          // dithering trick inspired by Duke
          volume.dist *= 0.9 + 0.1 * rng;
          
          // keep track of distance for z-buffer
          distance += volume.dist;

          // keep marching
          pos += ray * volume.dist;

          
      }

      if(color == vec4(0,0,0,1)) {
        discard;
      }
      
      // color.a = min(1.0, max(0.8, audioModifier * 3.0));
      color.a = 1.0;
      // gl_FragColor.xyz = vec3(gl_FragDepth);
      gl_FragColor = color;
  }
`
)

extend({ VolumetricMaterial })

export default VolumetricMaterial

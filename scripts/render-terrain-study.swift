// Exact terrain-data comparison; no browser or screenshot automation.
// swift -module-cache-path /tmp/terrain-study-cache scripts/render-terrain-study.swift before.json after.json output.png
import Foundation
import CoreGraphics
import AppKit
import ImageIO
import UniformTypeIdentifiers
let args=CommandLine.arguments
if args.count != 4 { fatalError("Expected before.json after.json output.png") }
func read(_ path:String)->[String:Any]{try! JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:path))) as! [String:Any]}
let docs=[read(args[1]),read(args[2])],W=2600,H=1310,scale=58.0,margin=90.0,top=1130.0
let ctx=CGContext(data:nil,width:W,height:H,bitsPerComponent:8,bytesPerRow:W*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
NSGraphicsContext.current=NSGraphicsContext(cgContext:ctx,flipped:false)
func fill(_ r:Double,_ g:Double,_ b:Double,_ a:Double=1){ctx.setFillColor(CGColor(red:r,green:g,blue:b,alpha:a))}
func stroke(_ r:Double,_ g:Double,_ b:Double,_ a:Double=1){ctx.setStrokeColor(CGColor(red:r,green:g,blue:b,alpha:a))}
func text(_ s:String,_ x:Double,_ y:Double,_ size:Double,_ color:NSColor = NSColor(red:0.25,green:0.34,blue:0.27,alpha:1),_ bold:Bool=false){let font=NSFont.systemFont(ofSize:size,weight:bold ? .semibold:.regular);(s as NSString).draw(at:NSPoint(x:x,y:y),withAttributes:[.font:font,.foregroundColor:color])}
fill(0.955,0.956,0.926);ctx.fill(CGRect(x:0,y:0,width:W,height:H))
text("云岫山境 · 山系布局收拢",90,1230,36,NSColor(red:0.23,green:0.31,blue:0.25,alpha:1),true)
text("同一 20 × 16 km 范围  /  峰高保持  /  等高距 200 m",92,1188,21)
let stops:[(Double,[Double])]=[(1800,[0.44,0.56,0.44]),(2800,[0.54,0.63,0.49]),(3500,[0.68,0.72,0.56]),(4200,[0.74,0.74,0.62]),(4900,[0.77,0.79,0.72]),(5600,[0.88,0.91,0.85]),(6800,[0.97,0.98,0.94])]
func color(_ h:Double)->[Double]{for i in 1..<stops.count {if h<=stops[i].0{let t=max(0,min(1,(h-stops[i-1].0)/(stops[i].0-stops[i-1].0)));return (0..<3).map{stops[i-1].1[$0]*(1-t)+stops[i].1[$0]*t}}};return stops.last!.1}
for (panel,doc) in docs.enumerated(){
 let left=margin+Double(panel)*1260.0,base=doc["terrainBase"] as! [String:Any],nx=base["nx"] as! Int,ny=base["ny"] as! Int,heights=(base["values"] as! [NSNumber]).map{$0.doubleValue},features=doc["features"] as! [[String:Any]]
 func xy(_ p:[Double])->CGPoint{CGPoint(x:left+p[0]*scale,y:top-p[1]*scale)}
 func drawPath(_ ps:[[Double]],_ closed:Bool){ctx.beginPath();for(i,p)in ps.enumerated(){if i==0{ctx.move(to:xy(p))}else{ctx.addLine(to:xy(p))}};if closed{ctx.closePath()}}
 ctx.setShouldAntialias(false)
 for j in 0..<ny-1{for i in 0..<nx-1{let k=j*nx+i,h=heights[k],dx=(heights[j*nx+min(nx-1,i+1)]-heights[j*nx+max(0,i-1)])/100,dy=(heights[min(ny-1,j+1)*nx+i]-heights[max(0,j-1)*nx+i])/100,shade=max(0.64,min(1.18,(0.99-dx*0.27-dy*0.30)/sqrt(1+dx*dx*0.2+dy*dy*0.2))),c=color(h);fill(min(1,c[0]*shade),min(1,c[1]*shade),min(1,c[2]*shade));ctx.fill(CGRect(x:left+Double(i)*20/Double(nx-1)*scale,y:top-Double(j+1)*16/Double(ny-1)*scale,width:20/Double(nx-1)*scale+0.1,height:16/Double(ny-1)*scale+0.1))}}
 ctx.setShouldAntialias(true)
 for f in features {let type=f["type"] as! String,ps=f["points"] as! [[Double]],closed=f["closed"] as? Bool ?? false
  if type=="contour"{drawPath(ps,closed);stroke(0.39,0.40,0.30,(f["elevation"] as? Double ?? 0).truncatingRemainder(dividingBy:1000)==0 ? 0.46:0.23);ctx.setLineWidth(0.65);ctx.strokePath()}
  else if type=="forest" || type=="grassland" || type=="meadow"{drawPath(ps,true);fill(0.28,0.47,0.33,0.08);ctx.fillPath();drawPath(ps,true);stroke(0.26,0.44,0.30,0.45);ctx.setLineWidth(0.9);ctx.setLineDash(phase:0,lengths:[4,3]);ctx.strokePath();ctx.setLineDash(phase:0,lengths:[])}
  else if type=="lake"{drawPath(ps,true);fill(0.44,0.66,0.72);ctx.fillPath();drawPath(ps,true);stroke(0.33,0.52,0.58);ctx.setLineWidth(1);ctx.strokePath()}
  else if type=="river"{drawPath(ps,false);stroke(0.32,0.56,0.64,0.9);ctx.setLineWidth(1.4);ctx.strokePath()}
  else if type=="ridge"{drawPath(ps,false);stroke(0.48,0.40,0.31,0.5);ctx.setLineWidth(0.75);ctx.setLineDash(phase:0,lengths:[2,5]);ctx.strokePath();ctx.setLineDash(phase:0,lengths:[])}
 }
 var boxes=[CGRect]()
 let places=features.filter{["peak","village","lake"].contains($0["type"] as! String)}.sorted{a,b in let priority:[String:Int]=["peak":0,"village":1,"lake":2];return priority[a["type"] as! String]!<priority[b["type"] as! String]!}
 for f in places {let type=f["type"] as! String,ps=f["points"] as! [[Double]],c=[ps.map{$0[0]}.reduce(0,+)/Double(ps.count),ps.map{$0[1]}.reduce(0,+)/Double(ps.count)],p=xy(c),name=f["name"] as! String,isLow=f["clusterParent"] != nil,size=type=="peak" ? (isLow ? 17.0:20.0):17.0,alt=Int((f["elevation"] as? NSNumber)?.doubleValue ?? 0),w=max(Double(name.count)*size,70),height=36.0
  if type=="peak"{ctx.beginPath();ctx.move(to:CGPoint(x:p.x,y:p.y+8));ctx.addLine(to:CGPoint(x:p.x-6,y:p.y-4));ctx.addLine(to:CGPoint(x:p.x+6,y:p.y-4));ctx.closePath();fill(0.97,0.96,0.90);ctx.drawPath(using:.fillStroke)}else if type=="village"{fill(0.62,0.43,0.27);ctx.fill(CGRect(x:p.x-4,y:p.y-4,width:8,height:8))}
  let options:[(Double,Double)]=[(0,-42),(0,16),(-w/2-25,-10),(w/2+25,-10),(-50,35),(50,-65),(0,55)]
  var best:CGRect?=nil,bestScore=Double.infinity
  for(dx,dy)in options {let r=CGRect(x:p.x+dx-w/2,y:p.y+dy,width:w,height:height),over=boxes.reduce(0.0){$0+Double($1.intersection(r).isNull ? 0:$1.intersection(r).width*$1.intersection(r).height)},outside=max(0,left-r.minX)+max(0,r.maxX-left-1160)+max(0,r.maxY-top)+max(0,top-928-r.minY),score=over*100+outside*1000+hypot(dx,dy+42);if score<bestScore{best=r;bestScore=score}}
  let r=best!;boxes.append(r.insetBy(dx:-4,dy:-4));fill(0.96,0.96,0.91,0.76);ctx.fill(r.insetBy(dx:-2,dy:0));text(name,r.minX,r.minY+16,size);text("\(alt) m",r.minX,r.minY+1,13)
 }
 stroke(0.44,0.50,0.39,0.8);ctx.setLineWidth(1);ctx.stroke(CGRect(x:left,y:top-928,width:1160,height:928))
 text(panel==0 ? "调整前 · 峰群向外围延伸":"紧凑山系 04 · 高峰相连，低峰收拢",left,147,24,NSColor(red:0.24,green:0.33,blue:0.26,alpha:1),true)
 for x in stride(from:0,through:20,by:4){text("\(x)",left+Double(x)*scale-5,top+10,13)}
 text("0",left,109,14);text("2 km",left+112,109,14);stroke(0.30,0.37,0.27);ctx.setLineWidth(2);ctx.move(to:CGPoint(x:left,y:105));ctx.addLine(to:CGPoint(x:left+116,y:105));ctx.strokePath()
}
text("地形数据预览 · 同比例比较；网页交互以工作台为准",90,35,16,NSColor(red:0.44,green:0.48,blue:0.42,alpha:1))
let dest=CGImageDestinationCreateWithURL(URL(fileURLWithPath:args[3]) as CFURL,UTType.png.identifier as CFString,1,nil)!
CGImageDestinationAddImage(dest,ctx.makeImage()!,nil);CGImageDestinationFinalize(dest)

/* eslint-disable */
// MIT License

// Copyright (c) 2019 maximeq

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// Adapted from https://github.com/maximeq/three-js-capsule-geometry
// It uses the three-full module, and I want to avoid duplicate THREE versions

import * as THREE from 'three'

function CapsuleBufferGeometry(
  radiusTop,
  radiusBottom,
  height,
  radialSegments,
  heightSegments,
  capsTopSegments,
  capsBottomSegments,
  thetaStart,
  thetaLength
) {
  THREE.BufferGeometry.call(this)

  this.type = 'CapsuleBufferGeometry'

  this.parameters = {
    radiusTop: radiusTop,
    radiusBottom: radiusBottom,
    height: height,
    radialSegments: radialSegments,
    heightSegments: heightSegments,
    thetaStart: thetaStart,
    thetaLength: thetaLength,
  }

  const scope = this

  radiusTop = radiusTop !== undefined ? radiusTop : 1
  radiusBottom = radiusBottom !== undefined ? radiusBottom : 1
  height = height !== undefined ? height : 2

  radialSegments = Math.floor(radialSegments) || 8
  heightSegments = Math.floor(heightSegments) || 1
  capsTopSegments = Math.floor(capsTopSegments) || 2
  capsBottomSegments = Math.floor(capsBottomSegments) || 2

  thetaStart = thetaStart !== undefined ? thetaStart : 0.0
  thetaLength = thetaLength !== undefined ? thetaLength : 2.0 * Math.PI

  // Alpha is the angle such that Math.PI/2 - alpha is the cone part angle.
  const alpha = Math.acos((radiusBottom - radiusTop) / height)
  const eqRadii = radiusTop - radiusBottom === 0

  const vertexCount = calculateVertexCount()
  const indexCount = calculateIndexCount()

  // buffers
  const indices = new THREE.BufferAttribute(
    new (indexCount > 65535 ? Uint32Array : Uint16Array)(indexCount),
    1
  )
  const vertices = new THREE.BufferAttribute(
    new Float32Array(vertexCount * 3),
    3
  )
  const normals = new THREE.BufferAttribute(
    new Float32Array(vertexCount * 3),
    3
  )
  const uvs = new THREE.BufferAttribute(new Float32Array(vertexCount * 2), 2)

  // helper variables

  let index = 0
  let indexOffset = 0
  const indexArray = []
  const halfHeight = height / 2

  // generate geometry

  generateTorso()

  // build geometry

  this.setIndex(indices)
  this.setAttribute('position', vertices)
  this.setAttribute('normal', normals)
  this.setAttribute('uv', uvs)

  // helper functions

  function calculateVertexCount() {
    const count =
      (radialSegments + 1) *
      (heightSegments + 1 + capsBottomSegments + capsTopSegments)
    return count
  }

  function calculateIndexCount() {
    const count =
      radialSegments *
      (heightSegments + capsBottomSegments + capsTopSegments) *
      2 *
      3
    return count
  }

  function generateTorso() {
    let x, y
    const normal = new THREE.Vector3()
    const vertex = new THREE.Vector3()

    const cosAlpha = Math.cos(alpha)
    const sinAlpha = Math.sin(alpha)

    const cone_length = new THREE.Vector2(
      radiusTop * sinAlpha,
      halfHeight + radiusTop * cosAlpha
    )
      .sub(
        new THREE.Vector2(
          radiusBottom * sinAlpha,
          -halfHeight + radiusBottom * cosAlpha
        )
      )
      .length()

    // Total length for v texture coord
    const vl =
      radiusTop * alpha + cone_length + radiusBottom * (Math.PI / 2 - alpha)

    const groupCount = 0

    // generate vertices, normals and uvs

    let v = 0
    for (y = 0; y <= capsTopSegments; y++) {
      var indexRow = []

      var a = Math.PI / 2 - alpha * (y / capsTopSegments)

      v += (radiusTop * alpha) / capsTopSegments

      var cosA = Math.cos(a)
      var sinA = Math.sin(a)

      // calculate the radius of the current row
      var radius = cosA * radiusTop

      for (x = 0; x <= radialSegments; x++) {
        var u = x / radialSegments

        var theta = u * thetaLength + thetaStart

        var sinTheta = Math.sin(theta)
        var cosTheta = Math.cos(theta)

        // vertex
        vertex.x = radius * sinTheta
        vertex.y = halfHeight + sinA * radiusTop
        vertex.z = radius * cosTheta
        vertices.setXYZ(index, vertex.x, vertex.y, vertex.z)

        // normal
        normal.set(cosA * sinTheta, sinA, cosA * cosTheta)
        normals.setXYZ(index, normal.x, normal.y, normal.z)

        // uv
        uvs.setXY(index, u, 1 - v / vl)

        // save index of vertex in respective row
        indexRow.push(index)

        // increase index
        index++
      }

      // now save vertices of the row in our index array
      indexArray.push(indexRow)
    }

    const cone_height = height + cosAlpha * radiusTop - cosAlpha * radiusBottom
    const slope = (sinAlpha * (radiusBottom - radiusTop)) / cone_height
    for (y = 1; y <= heightSegments; y++) {
      var indexRow = []

      v += cone_length / heightSegments

      // calculate the radius of the current row
      var radius =
        sinAlpha *
        ((y * (radiusBottom - radiusTop)) / heightSegments + radiusTop)

      for (x = 0; x <= radialSegments; x++) {
        var u = x / radialSegments

        var theta = u * thetaLength + thetaStart

        var sinTheta = Math.sin(theta)
        var cosTheta = Math.cos(theta)

        // vertex
        vertex.x = radius * sinTheta
        vertex.y =
          halfHeight + cosAlpha * radiusTop - (y * cone_height) / heightSegments
        vertex.z = radius * cosTheta
        vertices.setXYZ(index, vertex.x, vertex.y, vertex.z)

        // normal
        normal.set(sinTheta, slope, cosTheta).normalize()
        normals.setXYZ(index, normal.x, normal.y, normal.z)

        // uv
        uvs.setXY(index, u, 1 - v / vl)

        // save index of vertex in respective row
        indexRow.push(index)

        // increase index
        index++
      }

      // now save vertices of the row in our index array
      indexArray.push(indexRow)
    }

    for (y = 1; y <= capsBottomSegments; y++) {
      var indexRow = []

      var a = Math.PI / 2 - alpha - (Math.PI - alpha) * (y / capsBottomSegments)

      v += (radiusBottom * alpha) / capsBottomSegments

      var cosA = Math.cos(a)
      var sinA = Math.sin(a)

      // calculate the radius of the current row
      var radius = cosA * radiusBottom

      for (x = 0; x <= radialSegments; x++) {
        var u = x / radialSegments

        var theta = u * thetaLength + thetaStart

        var sinTheta = Math.sin(theta)
        var cosTheta = Math.cos(theta)

        // vertex
        vertex.x = radius * sinTheta
        vertex.y = -halfHeight + sinA * radiusBottom
        vertex.z = radius * cosTheta
        vertices.setXYZ(index, vertex.x, vertex.y, vertex.z)

        // normal
        normal.set(cosA * sinTheta, sinA, cosA * cosTheta)
        normals.setXYZ(index, normal.x, normal.y, normal.z)

        // uv
        uvs.setXY(index, u, 1 - v / vl)

        // save index of vertex in respective row
        indexRow.push(index)

        // increase index
        index++
      }

      // now save vertices of the row in our index array
      indexArray.push(indexRow)
    }

    // generate indices

    for (x = 0; x < radialSegments; x++) {
      for (
        y = 0;
        y < capsTopSegments + heightSegments + capsBottomSegments;
        y++
      ) {
        // we use the index array to access the correct indices
        const i1 = indexArray[y][x]
        const i2 = indexArray[y + 1][x]
        const i3 = indexArray[y + 1][x + 1]
        const i4 = indexArray[y][x + 1]

        // face one
        indices.setX(indexOffset, i1)
        indexOffset++
        indices.setX(indexOffset, i2)
        indexOffset++
        indices.setX(indexOffset, i4)
        indexOffset++

        // face two
        indices.setX(indexOffset, i2)
        indexOffset++
        indices.setX(indexOffset, i3)
        indexOffset++
        indices.setX(indexOffset, i4)
        indexOffset++
      }
    }
  }
}

CapsuleBufferGeometry.prototype = Object.create(THREE.BufferGeometry.prototype)
CapsuleBufferGeometry.prototype.constructor = CapsuleBufferGeometry

export default CapsuleBufferGeometry
